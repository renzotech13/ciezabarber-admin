import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Loader2, LockKeyhole, Unlock } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth"
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

/**
 * Arqueo del turno: se abre con el fondo de caja y se cierra contando lo que
 * hay. Mientras está abierta va sumando lo que se movió desde que se abrió
 * (servicios atendidos + productos vendidos), para tener contra qué comparar.
 *
 * Ojo con lo que ese total significa: incluye TODO lo cobrado, no solo el
 * efectivo — los adelantos entran por Yape y muchas ventas también. Por eso
 * la diferencia al cerrar no es un descuadre, es sobre todo lo que no pasó
 * por la caja; el campo de nota está para dejar constancia de eso.
 */
export default function Caja() {
  const { session } = useAuth()
  const [sesiones, setSesiones] = useState<Sesion[]>([])
  const [cargando, setCargando] = useState(true)
  const [movido, setMovido] = useState<{ servicios: number; productos: number } | null>(null)

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
          .select("services!inner(price)")
          .eq("estado", "completada")
          .gte("inicio_utc", desde),
        supabase.from("ventas_productos").select("cantidad, precio_unitario").gte("vendido_at", desde),
      ])
      if (!activo) return
      const servicios = ((citasRes.data ?? []) as unknown as { services: { price: string } }[]).reduce(
        (s, c) => s + (precioNumerico(c.services.price) ?? 0),
        0,
      )
      const productos = ((ventasRes.data ?? []) as { cantidad: number; precio_unitario: number }[]).reduce(
        (s, v) => s + v.cantidad * v.precio_unitario,
        0,
      )
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

  const totalMovido = (movido?.servicios ?? 0) + (movido?.productos ?? 0)
  const esperadoEnCaja = (abierta?.monto_inicial ?? 0) + totalMovido

  return (
    <div className="space-y-5">
      {abierta ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Tile etiqueta="Fondo de caja" valor={formatoSoles(abierta.monto_inicial)} detalle={fechaHora(abierta.abierta_at)} />
            <Tile etiqueta="Servicios atendidos" valor={formatoSoles(movido?.servicios ?? 0)} />
            <Tile etiqueta="Productos vendidos" valor={formatoSoles(movido?.productos ?? 0)} />
            <Tile etiqueta="Si todo fuera efectivo" valor={formatoSoles(esperadoEnCaja)} detalle="fondo + lo movido" />
          </div>

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
                  Contra el total de arriba faltan{" "}
                  <span className="tnum font-semibold text-foreground">
                    {formatoSoles(Math.max(0, esperadoEnCaja - Number(montoContado)))}
                  </span>
                  , que es lo que se habría cobrado por Yape o transferencia. Déjalo anotado abajo si algo no cuadra.
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
