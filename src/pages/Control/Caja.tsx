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
import { formatoSoles } from "./rango"

type Sesion = {
  id: string
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

type CitaCobrada = { metodo_pago: MetodoPago | null; services: { price: string } }
type VentaCobrada = { cantidad: number; precio_unitario: number; metodo_pago: MetodoPago | null }

/** Acumulador por medio de pago. "sin_marcar" son los cobros de antes de la 0024. */
function vacio(): Record<MetodoPago | "sin_marcar", number> {
  return { yape_plin: 0, tarjeta: 0, efectivo: 0, sin_marcar: 0 }
}

/**
 * Arqueo del turno: se abre con el fondo de caja y se cierra contando lo que
 * hay. Mientras está abierta va sumando lo que se movió desde que se abrió
 * (servicios atendidos + productos vendidos), repartido por medio de pago.
 *
 * Ese reparto es lo que hace que el arqueo signifique algo: en el cajón solo
 * tiene que estar el fondo más lo cobrado EN EFECTIVO. Lo de Yape/Plin y lo
 * del POS entró por otro lado, así que sumarlo al esperado convertía cada
 * cierre en un falso descuadre.
 */
export default function Caja() {
  const { session } = useAuth()
  const [sesiones, setSesiones] = useState<Sesion[]>([])
  const [cargando, setCargando] = useState(true)
  type PorMetodo = Record<MetodoPago | "sin_marcar", number>
  const [movido, setMovido] = useState<{ servicios: PorMetodo; productos: PorMetodo } | null>(null)

  const [montoInicial, setMontoInicial] = useState("0")
  const [montoContado, setMontoContado] = useState("")
  const [nota, setNota] = useState("")
  const [guardando, setGuardando] = useState(false)

  const abierta = useMemo(() => sesiones.find((s) => s.cerrada_at == null) ?? null, [sesiones])

  const cargar = useCallback(async () => {
    const { data, error } = await supabase
      .from("caja_sesiones")
      .select("*")
      .order("abierta_at", { ascending: false })
      .limit(30)
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

  // Lo movido desde que se abrió la caja: se recalcula al abrir/cerrar y al
  // entrar, que es cuando importa.
  useEffect(() => {
    if (!abierta) {
      setMovido(null)
      return
    }
    let activo = true
    async function calcular() {
      const desde = abierta!.abierta_at
      const [citasRes, ventasRes] = await Promise.all([
        supabase
          .from("citas")
          .select("metodo_pago, services!inner(price)")
          .eq("estado", "completada")
          .gte("inicio_utc", desde),
        supabase
          .from("ventas_productos")
          .select("cantidad, precio_unitario, metodo_pago")
          .gte("vendido_at", desde),
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
    calcular()
    return () => {
      activo = false
    }
  }, [abierta])

  async function abrirCaja() {
    const inicial = Number(montoInicial)
    if (montoInicial.trim() === "" || !Number.isFinite(inicial) || inicial < 0) {
      return toast.error("Pon con cuánto efectivo arranca la caja.")
    }
    setGuardando(true)
    const { error } = await supabase.from("caja_sesiones").insert({
      monto_inicial: inicial,
      abierta_por: session?.user.id ?? null,
    })
    setGuardando(false)
    if (error) {
      // El índice único es la garantía real de que no haya dos turnos vivos.
      toast.error(
        error.code === "23505" ? "Ya hay una caja abierta." : "No se pudo abrir la caja.",
      )
      return
    }
    toast.success("Caja abierta.")
    setMontoInicial("0")
    cargar()
  }

  async function cerrarCaja() {
    if (!abierta) return
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
      .eq("id", abierta.id)
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
  // Lo que TIENE que estar en el cajón: el fondo más lo cobrado en efectivo.
  const esperadoEnCaja = (abierta?.monto_inicial ?? 0) + porMetodo.efectivo
  const totalServicios = Object.values(movido?.servicios ?? {}).reduce((s, n) => s + n, 0)
  const totalProductos = Object.values(movido?.productos ?? {}).reduce((s, n) => s + n, 0)

  return (
    <div className="space-y-5">
      {abierta ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Tile etiqueta="Fondo de caja" valor={formatoSoles(abierta.monto_inicial)} detalle={fechaHora(abierta.abierta_at)} />
            <Tile etiqueta="Servicios atendidos" valor={formatoSoles(totalServicios)} />
            <Tile etiqueta="Productos vendidos" valor={formatoSoles(totalProductos)} />
            <Tile
              etiqueta="Debería haber en el cajón"
              valor={formatoSoles(esperadoEnCaja)}
              detalle="fondo + efectivo"
            />
          </div>

          <Ficha>
            <CabeceraFicha mini={`${formatoSoles(totalMovido)} movidos en el turno`} titulo="Cómo pagaron" />
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
                {formatoSoles(porMetodo.sin_marcar)} sin medio de pago marcado — quedan fuera del efectivo
                esperado. Se corrige en la ficha de cada reserva.
              </p>
            )}
          </Ficha>

          <Ficha>
            <CabeceraFicha mini={`Abierta el ${fechaHora(abierta.abierta_at)}`} titulo="Cerrar caja" />
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
                      contra el fondo más el efectivo del turno. Déjalo anotado abajo.
                    </>
                  )}
                </p>
              )}

              <div className="space-y-1.5">
                <Label className="brand-serif">Nota del cierre (opcional)</Label>
                <Textarea
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  placeholder="Ej. 3 cortes cobrados por Yape, se sacó S/ 20 para gaseosas…"
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
        </>
      ) : (
        <Ficha>
          <CabeceraFicha mini="No hay ninguna caja abierta" titulo="Abrir caja" />
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
                El sencillo con el que abre el día, para poder dar vuelto.
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
      )}

      <Ficha>
        <CabeceraFicha mini="Cierres anteriores" titulo="Historial de caja" />
        {sesiones.filter((s) => s.cerrada_at).length === 0 ? (
          <p className="brand-serif px-5 py-8 text-center text-sm text-muted-foreground">
            Todavía no hay cierres registrados.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="brand-serif px-4 py-2.5 font-normal text-muted-foreground">Turno</th>
                  <th className="brand-wide px-3 py-2.5 text-right text-[10px]">Fondo</th>
                  <th className="brand-wide px-3 py-2.5 text-right text-[10px]">Contado</th>
                  <th className="brand-serif px-4 py-2.5 font-normal text-muted-foreground">Nota</th>
                </tr>
              </thead>
              <tbody>
                {sesiones
                  .filter((s) => s.cerrada_at)
                  .map((s) => (
                    <tr key={s.id} className="border-b border-border/60 last:border-b-0">
                      <td className="whitespace-nowrap px-4 py-2">
                        {fechaHora(s.abierta_at)}
                        <span className="text-muted-foreground"> → {fechaHora(s.cerrada_at!)}</span>
                      </td>
                      <td className="tnum px-3 py-2 text-right">{formatoSoles(s.monto_inicial)}</td>
                      <td className="tnum px-3 py-2 text-right font-semibold">{formatoSoles(s.monto_contado ?? 0)}</td>
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
