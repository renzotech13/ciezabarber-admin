import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Loader2, LockKeyhole, Unlock } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth"
import { METODOS_PAGO, METODO_PAGO_LABEL, type MetodoPago } from "@/lib/types"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Ficha, CabeceraFicha, Tile } from "./ui"
import {
  cicloActual,
  cicloDe,
  formatoSoles,
  inicioDiaLimaUTC,
  finDiaLimaUTC,
  etiquetaLarga,
  type Ciclo,
} from "./rango"

type Sesion = {
  id: string
  ciclo: string
  monto_inicial: number
  abierta_at: string
  monto_contado: number | null
  cerrada_at: string | null
  nota: string | null
}

const TZ = "America/Lima"

function fechaHora(iso: string): string {
  return new Date(iso).toLocaleString("es-PE", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/** El mismo parser estricto del libro de comisiones. */
const PRECIO_REGEX = /^\s*(?:s\/\.?\s*)?(\d+(?:[.,]\d{1,2})?)\s*$/i
function precioNumerico(price: string): number | null {
  const m = PRECIO_REGEX.exec(String(price))
  if (!m) return null
  const n = Number(m[1]!.replace(",", "."))
  return Number.isFinite(n) && n > 0 ? n : null
}

type PorMetodo = Record<MetodoPago | "sin_marcar", number>
type CitaCobrada = { metodo_pago: MetodoPago | null; services: { price: string } }
type VentaCobrada = { cantidad: number; precio_unitario: number; metodo_pago: MetodoPago | null }

function vacio(): PorMetodo {
  return { yape_plin: 0, tarjeta: 0, efectivo: 0, sin_marcar: 0 }
}

/**
 * Arqueo del mes de caja: abre el 16 con el fondo y cierra el 15 contando lo
 * que hay. Los totales salen de la ventana completa del ciclo (no de la hora
 * en que alguien apretó "abrir"), así que registrar el fondo un día tarde no
 * deja el periodo cojo.
 *
 * En el cajón solo tiene que estar el fondo más lo cobrado EN EFECTIVO: lo de
 * Yape/Plin y lo del POS entró por otro lado. Por eso todo se muestra
 * repartido por medio de pago — sumarlo junto convertía cada cierre en un
 * falso descuadre.
 */
export default function Caja({ ciclo }: { ciclo: Ciclo }) {
  const { session } = useAuth()
  const [sesiones, setSesiones] = useState<Sesion[]>([])
  const [cargando, setCargando] = useState(true)
  const [movido, setMovido] = useState<{ servicios: PorMetodo; productos: PorMetodo } | null>(null)

  const [montoInicial, setMontoInicial] = useState("0")
  const [montoContado, setMontoContado] = useState("")
  const [nota, setNota] = useState("")
  const [guardando, setGuardando] = useState(false)

  const caja = useMemo(() => sesiones.find((s) => s.ciclo === ciclo.clave) ?? null, [sesiones, ciclo.clave])
  const esCicloActual = ciclo.clave === cicloActual().clave
  // El cierre toca el 15; antes de eso se puede cerrar igual (el dueño manda),
  // pero el aviso deja claro que el periodo sigue corriendo.
  const cierraHoyOAntes = !esCicloActual

  const cargar = useCallback(async () => {
    const { data, error } = await supabase
      .from("caja_sesiones")
      .select("*")
      .order("ciclo", { ascending: false })
      .limit(24)
    if (error) {
      toast.error("No se pudo cargar la caja.")
      setSesiones([])
    } else {
      setSesiones((data as Sesion[] | null) ?? [])
    }
    setCargando(false)
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  // Lo movido dentro de la ventana del ciclo, repartido por medio de pago.
  useEffect(() => {
    let activo = true
    async function calcular() {
      const desde = inicioDiaLimaUTC(ciclo.desde)
      const hasta = finDiaLimaUTC(ciclo.hasta)
      const [citasRes, ventasRes] = await Promise.all([
        supabase
          .from("citas")
          .select("metodo_pago, services!inner(price)")
          .eq("estado", "completada")
          .gte("inicio_utc", desde)
          .lt("inicio_utc", hasta),
        supabase
          .from("ventas_productos")
          .select("cantidad, precio_unitario, metodo_pago")
          .gte("vendido_at", desde)
          .lt("vendido_at", hasta),
      ])
      if (!activo) return

      const servicios = vacio()
      for (const c of (citasRes.data ?? []) as unknown as CitaCobrada[]) {
        servicios[c.metodo_pago ?? "sin_marcar"] += precioNumerico(c.services.price) ?? 0
      }
      const productos = vacio()
      for (const v of (ventasRes.data ?? []) as VentaCobrada[]) {
        productos[v.metodo_pago ?? "sin_marcar"] += v.cantidad * v.precio_unitario
      }
      setMovido({ servicios, productos })
    }
    setMovido(null)
    calcular()
    return () => {
      activo = false
    }
  }, [ciclo.desde, ciclo.hasta])

  async function abrirCaja() {
    const inicial = Number(montoInicial)
    if (montoInicial.trim() === "" || !Number.isFinite(inicial) || inicial < 0) {
      return toast.error("Pon con cuánto efectivo arranca la caja.")
    }
    setGuardando(true)
    const { error } = await supabase.from("caja_sesiones").insert({
      ciclo: ciclo.clave,
      monto_inicial: inicial,
      abierta_por: session?.user.id ?? null,
    })
    setGuardando(false)
    if (error) {
      // El índice único por ciclo es la garantía real de que no haya dos.
      toast.error(error.code === "23505" ? "Ese mes de caja ya está abierto." : "No se pudo abrir la caja.")
      return
    }
    toast.success("Caja abierta.")
    setMontoInicial("0")
    cargar()
  }

  async function cerrarCaja() {
    if (!caja) return
    const contado = Number(montoContado)
    if (montoContado.trim() === "" || !Number.isFinite(contado) || contado < 0) {
      return toast.error("Pon cuánto efectivo contaste.")
    }
    setGuardando(true)
    const { error } = await supabase
      .from("caja_sesiones")
      .update({
        monto_contado: contado,
        cerrada_at: new Date().toISOString(),
        cerrada_por: session?.user.id ?? null,
        nota: nota.trim() || null,
      })
      .eq("id", caja.id)
    setGuardando(false)
    if (error) {
      toast.error("No se pudo cerrar la caja.")
      return
    }
    toast.success("Caja cerrada.")
    setMontoContado("")
    setNota("")
    cargar()
  }

  if (cargando) {
    return (
      <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Cargando la caja…
      </div>
    )
  }

  const porMetodo = vacio()
  for (const clave of Object.keys(porMetodo) as (MetodoPago | "sin_marcar")[]) {
    porMetodo[clave] = (movido?.servicios[clave] ?? 0) + (movido?.productos[clave] ?? 0)
  }
  const totalMovido = Object.values(porMetodo).reduce((s, n) => s + n, 0)
  const totalServicios = Object.values(movido?.servicios ?? {}).reduce((s, n) => s + n, 0)
  const totalProductos = Object.values(movido?.productos ?? {}).reduce((s, n) => s + n, 0)
  const esperadoEnCaja = (caja?.monto_inicial ?? 0) + porMetodo.efectivo
  const cerrada = caja?.cerrada_at != null

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          etiqueta="Fondo de caja"
          valor={caja ? formatoSoles(caja.monto_inicial) : "—"}
          detalle={caja ? `abierta ${fechaHora(caja.abierta_at)}` : "sin abrir"}
        />
        <Tile etiqueta="Servicios atendidos" valor={formatoSoles(totalServicios)} />
        <Tile etiqueta="Productos vendidos" valor={formatoSoles(totalProductos)} />
        <Tile
          etiqueta="Debería haber en el cajón"
          valor={formatoSoles(esperadoEnCaja)}
          detalle="fondo + efectivo"
        />
      </div>

      <Ficha>
        <CabeceraFicha
          mini={`${formatoSoles(totalMovido)} movidos entre el ${etiquetaLarga(ciclo.desde)} y el ${etiquetaLarga(ciclo.hasta)}`}
          titulo="Cómo pagaron"
        />
        <div className="grid gap-px bg-border sm:grid-cols-3">
          {METODOS_PAGO.map((m) => (
            <div key={m} className="bg-card px-5 py-4">
              <div className="brand-wide tnum text-[22px] leading-none">{formatoSoles(porMetodo[m])}</div>
              <div className="brand-serif mt-2 text-[13px] text-muted-foreground">{METODO_PAGO_LABEL[m]}</div>
            </div>
          ))}
        </div>
        {porMetodo.sin_marcar > 0 && (
          <p className="brand-serif border-t border-border px-5 py-3 text-[12px] text-muted-foreground">
            {formatoSoles(porMetodo.sin_marcar)} sin medio de pago marcado — quedan fuera del efectivo esperado. Se
            corrige en la ficha de cada reserva.
          </p>
        )}
      </Ficha>

      {!caja ? (
        <Ficha>
          <CabeceraFicha
            mini={esCicloActual ? "Este mes de caja todavía no se abre" : "No se abrió caja en este mes"}
            titulo={`Abrir caja · ${ciclo.etiqueta}`}
          />
          <div className="space-y-4 px-5 py-4">
            <div className="space-y-1.5">
              <Label className="brand-serif">¿Con cuánto efectivo arranca?</Label>
              <Input
                type="number"
                min={0}
                step="0.1"
                inputMode="decimal"
                value={montoInicial}
                onChange={(e) => setMontoInicial(e.target.value)}
                className="tnum h-12 max-w-48 text-[19px]"
              />
              <p className="brand-serif text-[12px] text-muted-foreground">
                El sencillo con el que abre el periodo el 16, para poder dar vuelto.
              </p>
            </div>
            <button
              onClick={abrirCaja}
              disabled={guardando}
              className="chip23 on inline-flex items-center gap-2 py-3 disabled:opacity-40"
            >
              {guardando ? <Loader2 className="size-3.5 animate-spin" /> : <Unlock className="size-3.5" />}
              Abrir caja
            </button>
          </div>
        </Ficha>
      ) : cerrada ? (
        <Ficha>
          <CabeceraFicha mini={`Cerrada el ${fechaHora(caja.cerrada_at!)}`} titulo="Cierre del periodo" />
          <div className="grid gap-px bg-border sm:grid-cols-3">
            <div className="bg-card px-5 py-4">
              <div className="brand-wide tnum text-[22px] leading-none">{formatoSoles(caja.monto_contado ?? 0)}</div>
              <div className="brand-serif mt-2 text-[13px] text-muted-foreground">Efectivo contado</div>
            </div>
            <div className="bg-card px-5 py-4">
              <div className="brand-wide tnum text-[22px] leading-none">{formatoSoles(esperadoEnCaja)}</div>
              <div className="brand-serif mt-2 text-[13px] text-muted-foreground">Esperado (fondo + efectivo)</div>
            </div>
            <div className="bg-card px-5 py-4">
              <div className="brand-wide tnum text-[22px] leading-none">
                {formatoSoles((caja.monto_contado ?? 0) - esperadoEnCaja)}
              </div>
              <div className="brand-serif mt-2 text-[13px] text-muted-foreground">Diferencia</div>
            </div>
          </div>
          {caja.nota && (
            <p className="brand-serif border-t border-border px-5 py-3 text-[13px] text-muted-foreground">{caja.nota}</p>
          )}
        </Ficha>
      ) : (
        <Ficha>
          <CabeceraFicha
            mini={cierraHoyOAntes ? "El periodo ya terminó" : `Cierra el ${etiquetaLarga(ciclo.hasta)}`}
            titulo={`Cerrar caja · ${ciclo.etiqueta}`}
          />
          <div className="space-y-4 px-5 py-4">
            <div className="space-y-1.5">
              <Label className="brand-serif">¿Cuánto efectivo contaste?</Label>
              <Input
                type="number"
                min={0}
                step="0.1"
                inputMode="decimal"
                value={montoContado}
                onChange={(e) => setMontoContado(e.target.value)}
                placeholder="0.00"
                className="tnum h-12 max-w-48 text-[19px]"
              />
            </div>

            {montoContado.trim() !== "" && Number.isFinite(Number(montoContado)) && (
              <p className="brand-serif text-[13px] text-muted-foreground">
                {Math.abs(esperadoEnCaja - Number(montoContado)) < 0.005 ? (
                  <>La caja cuadra: coincide con el fondo más el efectivo cobrado.</>
                ) : (
                  <>
                    {esperadoEnCaja > Number(montoContado) ? "Faltan " : "Sobran "}
                    <span className="tnum font-semibold text-foreground">
                      {formatoSoles(Math.abs(esperadoEnCaja - Number(montoContado)))}
                    </span>{" "}
                    contra el fondo más el efectivo del periodo. Déjalo anotado abajo.
                  </>
                )}
              </p>
            )}

            <div className="space-y-1.5">
              <Label className="brand-serif">Nota del cierre (opcional)</Label>
              <Textarea
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder="Ej. se sacó S/ 80 para insumos, faltó marcar 2 cortes…"
                rows={2}
              />
            </div>

            <button
              onClick={cerrarCaja}
              disabled={guardando}
              className="chip23 on inline-flex items-center gap-2 py-3 disabled:opacity-40"
            >
              {guardando ? <Loader2 className="size-3.5 animate-spin" /> : <LockKeyhole className="size-3.5" />}
              Cerrar caja
            </button>
          </div>
        </Ficha>
      )}

      <Ficha>
        <CabeceraFicha mini="Un mes de caja por fila (16 → 15)" titulo="Historial" />
        {sesiones.length === 0 ? (
          <p className="brand-serif px-5 py-8 text-center text-sm text-muted-foreground">
            Todavía no hay cajas registradas.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="brand-serif px-4 py-2.5 font-normal text-muted-foreground">Mes de caja</th>
                  <th className="brand-wide px-3 py-2.5 text-right text-[10px]">Fondo</th>
                  <th className="brand-wide px-3 py-2.5 text-right text-[10px]">Contado</th>
                  <th className="brand-serif px-4 py-2.5 font-normal text-muted-foreground">Nota</th>
                </tr>
              </thead>
              <tbody>
                {sesiones.map((s) => (
                  <tr
                    key={s.id}
                    className={
                      s.ciclo === ciclo.clave
                        ? "border-b border-border/60 bg-muted/40 last:border-b-0"
                        : "border-b border-border/60 last:border-b-0"
                    }
                  >
                    <td className="whitespace-nowrap px-4 py-2">
                      {cicloDe(s.ciclo).etiqueta}
                      {s.cerrada_at == null && <span className="text-muted-foreground"> · abierta</span>}
                    </td>
                    <td className="tnum px-3 py-2 text-right">{formatoSoles(s.monto_inicial)}</td>
                    <td className="tnum px-3 py-2 text-right font-semibold">
                      {s.monto_contado == null ? "—" : formatoSoles(s.monto_contado)}
                    </td>
                    <td className="brand-serif max-w-72 px-4 py-2 text-muted-foreground">{s.nota ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Ficha>
    </div>
  )
}
