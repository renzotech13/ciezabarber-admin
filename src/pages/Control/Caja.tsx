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
  diaLimaDe,
  hoyLima,
  sumarDias,
  formatoSoles,
  inicioDiaLimaUTC,
  finDiaLimaUTC,
  etiquetaLarga,
  type Periodo,
} from "./rango"

type TipoCaja = "dia" | "ciclo"

type Sesion = {
  id: string
  tipo: TipoCaja
  /** Día en que abre el periodo: el 16 en el mes de caja, el día mismo en la diaria. */
  periodo: string
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
 * Arqueo de caja, en dos escalas según el periodo que se esté mirando arriba:
 *
 *   - "Día": el arqueo operativo, el de contar el cajón antes de cerrar el
 *     local. Abre con el fondo de ese día y cuenta lo movido ese día.
 *   - Cualquier otro periodo: el mes de caja (16 → 15), que es el arqueo de
 *     liquidación del ciclo completo.
 *
 * Son dos lecturas del mismo dinero y conviven a propósito: cerrar el día no
 * cierra el mes ni al revés.
 *
 * Los totales salen de la ventana del periodo (no de la hora en que alguien
 * apretó "abrir"), así que registrar el fondo un rato tarde no lo deja cojo.
 * Y en el cajón solo tiene que estar el fondo más lo cobrado EN EFECTIVO: lo
 * de Yape/Plin y lo del POS entró por otro lado, así que todo se muestra
 * repartido por medio de pago — sumarlo junto convertía cada cierre en un
 * falso descuadre.
 */
export default function Caja({
  periodo,
  onIrADia,
}: {
  periodo: Periodo
  /** Saltar al arqueo de otro día (lo usa la lista de días sin cerrar). */
  onIrADia: (fecha: string) => void
}) {
  // El periodo "día" pide arqueo diario; el resto se arquea por mes de caja,
  // que es la unidad con la que el negocio liquida.
  const tipo: TipoCaja = periodo.tipo === "dia" ? "dia" : "ciclo"
  const ciclo = cicloDe(periodo.desde)
  const ventana = tipo === "dia" ? { desde: periodo.desde, hasta: periodo.desde } : ciclo
  const claveCaja = tipo === "dia" ? periodo.desde : ciclo.clave
  const etiquetaCaja = tipo === "dia" ? etiquetaLarga(periodo.desde) : ciclo.etiqueta
  const { session } = useAuth()
  const [sesiones, setSesiones] = useState<Sesion[]>([])
  const [cargando, setCargando] = useState(true)
  const [movido, setMovido] = useState<{ servicios: PorMetodo; productos: PorMetodo } | null>(null)

  const [montoInicial, setMontoInicial] = useState("0")
  const [montoContado, setMontoContado] = useState("")
  const [nota, setNota] = useState("")
  const [guardando, setGuardando] = useState(false)
  // Días que movieron plata y todavía no tienen su arqueo.
  const [diasConMovimiento, setDiasConMovimiento] = useState<Map<string, number>>(new Map())

  const caja = useMemo(
    () => sesiones.find((s) => s.tipo === tipo && s.periodo === claveCaja) ?? null,
    [sesiones, tipo, claveCaja],
  )
  // "En curso" = el día de hoy, o el mes de caja que corre. Antes de que
  // termine se puede cerrar igual (el dueño manda), pero conviene decirlo.
  const enCurso = tipo === "dia" ? periodo.desde === hoyLima() : ciclo.clave === cicloActual().clave

  const cargar = useCallback(async () => {
    const { data, error } = await supabase
      .from("caja_sesiones")
      .select("*")
      .eq("tipo", tipo)
      .order("periodo", { ascending: false })
      .limit(30)
    if (error) {
      toast.error("No se pudo cargar la caja.")
      setSesiones([])
    } else {
      setSesiones((data as Sesion[] | null) ?? [])
    }
    setCargando(false)
  }, [tipo])

  useEffect(() => {
    cargar()
  }, [cargar])

  // Lo movido dentro de la ventana del ciclo, repartido por medio de pago.
  useEffect(() => {
    let activo = true
    async function calcular() {
      const desde = inicioDiaLimaUTC(ventana.desde)
      const hasta = finDiaLimaUTC(ventana.hasta)
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
  }, [ventana.desde, ventana.hasta])

  /**
   * Los últimos días que movieron plata, para poder ver de un vistazo cuáles
   * quedaron sin arquear. Sin esta lista, un día sin cerrar solo se descubre
   * navegando hacia atrás a ver qué falta.
   */
  useEffect(() => {
    if (tipo !== "dia") return
    let activo = true
    async function calcular() {
      const desde = inicioDiaLimaUTC(sumarDias(hoyLima(), -14))
      const [citasRes, ventasRes] = await Promise.all([
        supabase
          .from("citas")
          .select("inicio_utc, services!inner(price)")
          .eq("estado", "completada")
          .gte("inicio_utc", desde),
        supabase.from("ventas_productos").select("vendido_at, cantidad, precio_unitario").gte("vendido_at", desde),
      ])
      if (!activo) return
      const porDia = new Map<string, number>()
      for (const c of (citasRes.data ?? []) as unknown as { inicio_utc: string; services: { price: string } }[]) {
        const dia = diaLimaDe(c.inicio_utc)
        porDia.set(dia, (porDia.get(dia) ?? 0) + (precioNumerico(c.services.price) ?? 0))
      }
      for (const v of (ventasRes.data ?? []) as { vendido_at: string; cantidad: number; precio_unitario: number }[]) {
        const dia = diaLimaDe(v.vendido_at)
        porDia.set(dia, (porDia.get(dia) ?? 0) + v.cantidad * v.precio_unitario)
      }
      setDiasConMovimiento(porDia)
    }
    calcular()
    return () => {
      activo = false
    }
  }, [tipo])

  async function abrirCaja() {
    const inicial = Number(montoInicial)
    if (montoInicial.trim() === "" || !Number.isFinite(inicial) || inicial < 0) {
      return toast.error("Pon con cuánto efectivo arranca la caja.")
    }
    setGuardando(true)
    const { error } = await supabase.from("caja_sesiones").insert({
      tipo,
      periodo: claveCaja,
      monto_inicial: inicial,
      abierta_por: session?.user.id ?? null,
    })
    setGuardando(false)
    if (error) {
      // El índice único por ciclo es la garantía real de que no haya dos.
      toast.error(
        error.code === "23505"
          ? tipo === "dia"
            ? "Ese día ya tiene su caja abierta."
            : "Ese mes de caja ya está abierto."
          : "No se pudo abrir la caja.",
      )
      return
    }
    toast.success("Caja abierta.")
    setMontoInicial("0")
    cargar()
  }

  /**
   * Un día que ya pasó se cierra de un tirón: fondo y efectivo contado en el
   * mismo formulario. Obligar a "abrir" primero un día que terminó hace
   * tres días es un trámite sin sentido — la caja de ese día ya vivió y lo
   * único que falta es dejarla asentada.
   */
  async function cerrarDiaRetroactivo() {
    const inicial = Number(montoInicial)
    const contado = Number(montoContado)
    if (montoInicial.trim() === "" || !Number.isFinite(inicial) || inicial < 0) {
      return toast.error("Pon con cuánto efectivo arrancó ese día.")
    }
    if (montoContado.trim() === "" || !Number.isFinite(contado) || contado < 0) {
      return toast.error("Pon cuánto efectivo quedó al cerrar.")
    }
    setGuardando(true)
    const ahora = new Date().toISOString()
    const { error } = await supabase.from("caja_sesiones").insert({
      tipo,
      periodo: claveCaja,
      monto_inicial: inicial,
      // La apertura se fecha al final del día que se está cerrando, no al
      // instante de cargarlo: así el historial no dice que la caja del 4 se
      // abrió el 6.
      abierta_at: finDiaLimaUTC(claveCaja),
      abierta_por: session?.user.id ?? null,
      monto_contado: contado,
      cerrada_at: ahora,
      cerrada_por: session?.user.id ?? null,
      nota: nota.trim() || null,
    })
    setGuardando(false)
    if (error) {
      toast.error(error.code === "23505" ? "Ese día ya tiene su caja." : "No se pudo cerrar ese día.")
      return
    }
    toast.success("Día cerrado.")
    setMontoInicial("0")
    setMontoContado("")
    setNota("")
    cargar()
  }

  /**
   * Deshace el cierre para corregirlo. Pasa antes de lo que parece: cerrar
   * de madrugada carga el arqueo en el día siguiente, y sin poder deshacerlo
   * ese error queda clavado en la contabilidad para siempre.
   */
  async function reabrirCaja() {
    if (!caja) return
    setGuardando(true)
    const { error } = await supabase
      .from("caja_sesiones")
      .update({ monto_contado: null, cerrada_at: null, cerrada_por: null })
      .eq("id", caja.id)
    setGuardando(false)
    if (error) {
      toast.error("No se pudo reabrir la caja.")
      return
    }
    toast.success("Caja reabierta: vuelve a cerrarla con los montos correctos.")
    cargar()
  }

  /** Borra el arqueo entero — para el que se cargó en el día equivocado. */
  async function eliminarCaja() {
    if (!caja) return
    if (!window.confirm("¿Borrar este arqueo? Se pierde el fondo, lo contado y la nota.")) return
    setGuardando(true)
    const { error } = await supabase.from("caja_sesiones").delete().eq("id", caja.id)
    setGuardando(false)
    if (error) {
      toast.error("No se pudo borrar el arqueo.")
      return
    }
    toast.success("Arqueo borrado.")
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

  // Días con movimiento que no tienen arqueo cerrado. El día en curso no
  // cuenta: todavía se está trabajando.
  const hoy = hoyLima()
  const cerrados = new Set(sesiones.filter((x) => x.cerrada_at != null).map((x) => x.periodo))
  const diasSinCerrar = [...diasConMovimiento.entries()]
    .filter(([dia, total]) => dia < hoy && total > 0 && !cerrados.has(dia))
    .map(([dia, total]) => ({ dia, total }))
    .sort((a, b) => b.dia.localeCompare(a.dia))

  return (
    <div className="space-y-5">
      {/* El selector de arriba decide qué caja es esta. Sin decirlo, mirar
          "setiembre" y ver un arqueo del 16 al 15 desconcierta. */}
      <p className="brand-serif border border-dashed border-border px-4 py-2.5 text-[13px] text-muted-foreground">
        {tipo === "dia" ? (
          <>
            Arqueo del <span className="text-foreground">{etiquetaCaja}</span>: lo que hay que contar en el cajón al
            cerrar el local. Con las flechas de arriba te mueves de día.
          </>
        ) : (
          <>
            Arqueo del mes de caja <span className="text-foreground">{etiquetaCaja}</span>, el del cierre del periodo.
            Para cerrar el cajón de un día suelto, elige <span className="text-foreground">Día</span> arriba.
          </>
        )}
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          etiqueta={tipo === "dia" ? "Fondo del día" : "Fondo de caja"}
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
          mini={
            tipo === "dia"
              ? `${formatoSoles(totalMovido)} movidos el ${etiquetaLarga(ventana.desde)}`
              : `${formatoSoles(totalMovido)} movidos entre el ${etiquetaLarga(ventana.desde)} y el ${etiquetaLarga(ventana.hasta)}`
          }
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
            mini={
              enCurso
                ? tipo === "dia"
                  ? "Hoy todavía no se abre caja"
                  : "Este mes de caja todavía no se abre"
                : tipo === "dia"
                  ? "Ese día no se abrió caja"
                  : "No se abrió caja en este mes"
            }
            titulo={`${tipo === "dia" && !enCurso ? "Cerrar el día" : "Abrir caja"} · ${etiquetaCaja}`}
          />
          <div className="space-y-4 px-5 py-4">
            <div className="space-y-1.5">
              <Label className="brand-serif">
                {tipo === "dia" && !enCurso ? "¿Con cuánto efectivo arrancó?" : "¿Con cuánto efectivo arranca?"}
              </Label>
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
                {tipo !== "dia"
                  ? "El sencillo con el que abre el periodo el 16, para poder dar vuelto."
                  : enCurso
                    ? "El sencillo con el que arranca el día, para poder dar vuelto."
                    : "El sencillo con el que arrancó ese día. Si no lo recuerdas, pon el de siempre."}
              </p>
            </div>
            {/* Un día que ya pasó se cierra de una: pedirle "abrir" primero
                a algo que terminó hace días es puro trámite. */}
            {tipo === "dia" && !enCurso && (
              <div className="space-y-1.5">
                <Label className="brand-serif">¿Cuánto efectivo quedó al cerrar?</Label>
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
                <Textarea
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  placeholder="Nota del cierre (opcional)"
                  rows={2}
                  className="mt-2"
                />
              </div>
            )}

            <button
              onClick={tipo === "dia" && !enCurso ? cerrarDiaRetroactivo : abrirCaja}
              disabled={guardando}
              className="chip23 on inline-flex items-center gap-2 py-3 disabled:opacity-40"
            >
              {guardando ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : tipo === "dia" && !enCurso ? (
                <LockKeyhole className="size-3.5" />
              ) : (
                <Unlock className="size-3.5" />
              )}
              {tipo === "dia" && !enCurso ? "Cerrar este día" : "Abrir caja"}
            </button>
          </div>
        </Ficha>
      ) : cerrada ? (
        <Ficha>
          <CabeceraFicha
            mini={`Cerrada el ${fechaHora(caja.cerrada_at!)}`}
            titulo={tipo === "dia" ? `Cierre del ${etiquetaCaja}` : "Cierre del periodo"}
          />
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
          <div className="flex flex-wrap items-center gap-2 border-t border-border px-5 py-3">
            <button onClick={reabrirCaja} disabled={guardando} className="chip23 disabled:opacity-40">
              Corregir cierre
            </button>
            <button
              onClick={eliminarCaja}
              disabled={guardando}
              className="chip23 disabled:opacity-40"
              style={{ borderColor: "var(--destructive)", color: "var(--destructive)" }}
            >
              Borrar arqueo
            </button>
            <span className="brand-serif text-[12px] text-muted-foreground">
              Si este arqueo quedó cargado en el día equivocado, bórralo y ciérralo en el día que le toca.
            </span>
          </div>
        </Ficha>
      ) : (
        <Ficha>
          <CabeceraFicha
            mini={
              !enCurso
                ? tipo === "dia"
                  ? "Ese día ya pasó"
                  : "El periodo ya terminó"
                : tipo === "dia"
                  ? "Cuenta el cajón antes de bajar la cortina"
                  : `Cierra el ${etiquetaLarga(ciclo.hasta)}`
            }
            titulo={`Cerrar caja · ${etiquetaCaja}`}
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
                    contra el fondo más el efectivo {tipo === "dia" ? "del día" : "del periodo"}. Déjalo anotado abajo.
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

      {tipo === "dia" && diasSinCerrar.length > 0 && (
        <Ficha>
          <CabeceraFicha
            mini="Movieron plata y nadie los arqueó"
            titulo={`Días sin cerrar (${diasSinCerrar.length})`}
          />
          <ul>
            {diasSinCerrar.map((d) => (
              <li
                key={d.dia}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-5 py-2.5 last:border-b-0"
              >
                <div className="text-[13px]">
                  <span className="font-medium capitalize">{etiquetaLarga(d.dia)}</span>
                  <span className="brand-serif text-muted-foreground"> · {formatoSoles(d.total)} movidos</span>
                </div>
                <button onClick={() => onIrADia(d.dia)} className="chip23">
                  Cerrar ese día
                </button>
              </li>
            ))}
          </ul>
        </Ficha>
      )}

      <Ficha>
        <CabeceraFicha
          mini={tipo === "dia" ? "Un día por fila" : "Un mes de caja por fila (16 → 15)"}
          titulo="Historial"
        />
        {sesiones.length === 0 ? (
          <p className="brand-serif px-5 py-8 text-center text-sm text-muted-foreground">
            Todavía no hay cajas registradas.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="brand-serif px-4 py-2.5 font-normal text-muted-foreground">
                    {tipo === "dia" ? "Día" : "Mes de caja"}
                  </th>
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
                      s.periodo === claveCaja
                        ? "border-b border-border/60 bg-muted/40 last:border-b-0"
                        : "border-b border-border/60 last:border-b-0"
                    }
                  >
                    <td className="whitespace-nowrap px-4 py-2">
                      {s.tipo === "dia" ? etiquetaLarga(s.periodo) : cicloDe(s.periodo).etiqueta}
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
