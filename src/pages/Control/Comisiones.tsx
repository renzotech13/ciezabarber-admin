import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { Download, Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { BARBEROS, METODO_PAGO_LABEL, type Barbero } from "@/lib/types"
import type { FiltroMetodo } from "./index"
import { GraficoBarrasApiladas, GraficoBarrasH, type DiaBarras } from "./charts"
import { Ficha, CabeceraFicha, Tile, LeyendaSerie } from "./ui"
import {
  type Rango, listarDias, inicioDiaLimaUTC, finDiaLimaUTC, diaLimaDe,
  etiquetaCorta, etiquetaLarga, formatoSoles,
} from "./rango"

/** Regla del negocio (la misma del Excel: "BRAYAN50%, NILTON50%…"). */
const COMISION_PCT = 0.5

/** Mismos colores que --chart-1/2/3 de index.css — orden fijo por barbero. */
const COLOR_BARBERO: Record<string, string> = {
  Cieza: "#a34d14",
  Nilton: "#0b8560",
  Bryan: "#5a55c9",
}
const COLOR_SIN_ASIGNAR = "#8d8e87"
const SIN_ASIGNAR = "Sin asignar"

type CitaFila = {
  id: string
  inicio_utc: string
  estado: string
  barbero: string | null
  metodo_pago: string | null
  services: { name: string; price: string }
  clientes: { nombre: string | null; telefono: string }
}

type Celda = { servicios: number; monto: number; sinPrecio: number }

const celdaVacia = (): Celda => ({ servicios: 0, monto: 0, sinPrecio: 0 })

/**
 * services.price es texto libre ("40", "S/ 40", "Consultar", "15–40"…). Solo
 * un número único y claro se convierte en dinero; cualquier otro formato cae
 * a "sin precio" (cuenta el servicio, marca asterisco) — un rango "40 - 60"
 * jamás debe volverse S/ 4060 en el libro de pagos.
 */
const PRECIO_REGEX = /^\s*(?:s\/\.?\s*)?(\d+(?:[.,]\d{1,2})?)\s*$/i

function precioNumerico(price: string): number | null {
  const m = PRECIO_REGEX.exec(String(price))
  if (!m) return null
  const n = Number(m[1]!.replace(",", "."))
  return Number.isFinite(n) && n > 0 ? n : null
}

export default function Comisiones({ rango, metodo }: { rango: Rango; metodo: FiltroMetodo }) {
  const [citas, setCitas] = useState<CitaFila[]>([])
  const [cargando, setCargando] = useState(true)
  const [asignando, setAsignando] = useState<string | null>(null)
  // Solo la última carga lanzada puede escribir estado: sin esto, cambiar de
  // rango rápido deja que una respuesta lenta y vieja pise a la nueva.
  const versionCarga = useRef(0)

  const cargar = useCallback(async () => {
    const version = ++versionCarga.current
    // Servicios efectivamente atendidos: confirmadas/completadas y ya pasadas.
    // Canceladas, expiradas y no-asistió no pagan comisión.
    // Con filtro de medio de pago solo entran las citas cobradas así: las que
    // todavía no lo tienen marcado quedan fuera a propósito (no se sabe cómo
    // pagaron, y meterlas en "efectivo" sería inventar el arqueo).
    let consulta = supabase
      .from("citas")
      .select("id, inicio_utc, estado, barbero, metodo_pago, services!inner(name, price), clientes!inner(nombre, telefono)")
      .gte("inicio_utc", inicioDiaLimaUTC(rango.desde))
      .lt("inicio_utc", finDiaLimaUTC(rango.hasta))
      .in("estado", ["confirmada", "completada"])
    if (metodo !== "all") consulta = consulta.eq("metodo_pago", metodo)
    const { data, error } = await consulta.order("inicio_utc")
    if (version !== versionCarga.current) return
    if (error) {
      toast.error("No se pudieron cargar las citas del periodo.")
      // Vaciar antes que mentir: los números del rango anterior no pueden
      // quedarse debajo de la cabecera del rango nuevo.
      setCitas([])
      setCargando(false)
      return
    }
    const ahora = Date.now()
    // 'completada' la marcó una persona: cuenta aunque la cita se haya
    // atendido antes de su hora agendada. El corte por hora aplica solo a
    // 'confirmada' (que todavía es una promesa, no un servicio hecho).
    setCitas(
      ((data ?? []) as unknown as CitaFila[]).filter(
        (c) => c.estado === "completada" || new Date(c.inicio_utc).getTime() <= ahora,
      ),
    )
    setCargando(false)
  }, [rango.desde, rango.hasta, metodo])

  useEffect(() => {
    setCargando(true)
    cargar()
  }, [cargar])

  const hoy = diaLimaDe(new Date().toISOString())
  // El libro llega solo hasta hoy: los días futuros del rango aún no existen.
  const dias = useMemo(() => listarDias(rango).filter((d) => d <= hoy), [rango, hoy])

  const { porDia, totalPorBarbero, haySinAsignar, sinPrecioTotal } = useMemo(() => {
    const porDia = new Map<string, Map<string, Celda>>()
    const totalPorBarbero = new Map<string, Celda>()
    let sinPrecioTotal = 0

    for (const cita of citas) {
      const dia = diaLimaDe(cita.inicio_utc)
      const barbero = cita.barbero ?? SIN_ASIGNAR
      const precio = precioNumerico(cita.services.price)

      const fila = porDia.get(dia) ?? new Map<string, Celda>()
      const celda = fila.get(barbero) ?? celdaVacia()
      const total = totalPorBarbero.get(barbero) ?? celdaVacia()
      celda.servicios += 1
      total.servicios += 1
      if (precio != null) {
        celda.monto += precio
        total.monto += precio
      } else {
        celda.sinPrecio += 1
        total.sinPrecio += 1
        sinPrecioTotal += 1
      }
      fila.set(barbero, celda)
      porDia.set(dia, fila)
      totalPorBarbero.set(barbero, total)
    }
    return { porDia, totalPorBarbero, haySinAsignar: totalPorBarbero.has(SIN_ASIGNAR), sinPrecioTotal }
  }, [citas])

  // Columnas del libro: los barberos fijos + "Sin asignar" solo si aparece.
  const columnas = useMemo(
    () => [...BARBEROS, ...(haySinAsignar ? [SIN_ASIGNAR] : [])],
    [haySinAsignar],
  )
  const colorDe = (b: string) => COLOR_BARBERO[b] ?? COLOR_SIN_ASIGNAR

  const totalServicios = citas.length
  const totalIngresos = [...totalPorBarbero.values()].reduce((s, c) => s + c.monto, 0)
  const totalPago = totalIngresos * COMISION_PCT

  const diasGrafico: DiaBarras[] = dias.map((d) => ({
    etiqueta: etiquetaCorta(d),
    etiquetaLarga: etiquetaLarga(d),
    segmentos: columnas.map((b) => ({
      clave: b,
      valor: porDia.get(d)?.get(b)?.servicios ?? 0,
      color: colorDe(b),
    })),
  }))

  const sinBarbero = useMemo(() => citas.filter((c) => !c.barbero), [citas])

  async function asignarBarbero(citaId: string, barbero: Barbero) {
    setAsignando(citaId)
    const { error } = await supabase.from("citas").update({ barbero }).eq("id", citaId)
    if (error) {
      setAsignando(null)
      toast.error("No se pudo asignar el barbero.")
      return
    }
    toast.success(`Asignada a ${barbero}.`)
    // El botón sigue deshabilitado hasta que la lista se refresca — si se
    // soltara ya, un segundo click dispararía otro update sobre datos viejos.
    await cargar()
    setAsignando(null)
  }

  function exportarCSV() {
    const cab = [
      "Fecha",
      ...columnas,
      "Total servicios",
      ...columnas.map((b) => `${b} ${COMISION_PCT * 100}%`),
      "Total pago",
    ]
    const filas = dias.map((d) => {
      const fila = porDia.get(d)
      const conteos = columnas.map((b) => fila?.get(b)?.servicios ?? 0)
      const pagos = columnas.map((b) => ((fila?.get(b)?.monto ?? 0) * COMISION_PCT).toFixed(2))
      const totalDia = columnas.reduce((s, b) => s + (fila?.get(b)?.monto ?? 0), 0)
      return [etiquetaCorta(d), ...conteos, conteos.reduce((a, b) => a + b, 0), ...pagos, (totalDia * COMISION_PCT).toFixed(2)]
    })
    const totales = [
      "TOTAL",
      ...columnas.map((b) => totalPorBarbero.get(b)?.servicios ?? 0),
      totalServicios,
      ...columnas.map((b) => ((totalPorBarbero.get(b)?.monto ?? 0) * COMISION_PCT).toFixed(2)),
      totalPago.toFixed(2),
    ]
    const csv = [cab, ...filas, totales].map((f) => f.join(",")).join("\n")
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }))
    const a = document.createElement("a")
    a.href = url
    a.download = `comisiones-${rango.desde}-a-${rango.hasta}${metodo === "all" ? "" : `-${metodo}`}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (cargando) {
    return (
      <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Cargando el periodo…
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {metodo !== "all" && (
        <p className="brand-serif border border-dashed border-border px-4 py-2.5 text-[13px] text-muted-foreground">
          Mostrando solo lo cobrado con <span className="text-foreground">{METODO_PAGO_LABEL[metodo]}</span>. Las citas sin
          medio de pago marcado no entran en este total.
        </p>
      )}

      {/* Cifras del periodo */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Tile etiqueta="Servicios atendidos" valor={String(totalServicios)} />
        <Tile etiqueta="Ingresos por servicios" valor={formatoSoles(totalIngresos)} />
        <Tile etiqueta="Total a pagar (50%)" valor={formatoSoles(totalPago)} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {BARBEROS.map((b) => {
          const t = totalPorBarbero.get(b)
          return (
            <Tile
              key={b}
              marca={colorDe(b)}
              etiqueta={b}
              valor={formatoSoles((t?.monto ?? 0) * COMISION_PCT)}
              detalle={`${t?.servicios ?? 0} servicio${(t?.servicios ?? 0) === 1 ? "" : "s"}`}
            />
          )
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
        <Ficha>
          <CabeceraFicha mini="Por día del periodo" titulo="Servicios por barbero" extra={
            <LeyendaSerie items={columnas.map((b) => ({ etiqueta: b, color: colorDe(b) }))} />
          } />
          <div className="px-5 py-4">
            {totalServicios === 0
              ? <p className="brand-serif py-10 text-center text-sm text-muted-foreground">Sin servicios atendidos en este periodo.</p>
              : <GraficoBarrasApiladas dias={diasGrafico} />}
          </div>
        </Ficha>

        <Ficha>
          <CabeceraFicha mini="Comisión del periodo" titulo="Pago por barbero" />
          <div className="px-5 py-4">
            <GraficoBarrasH
              items={BARBEROS.map((b) => {
                const t = totalPorBarbero.get(b)
                return {
                  etiqueta: b,
                  valor: (t?.monto ?? 0) * COMISION_PCT,
                  textoValor: formatoSoles((t?.monto ?? 0) * COMISION_PCT),
                  color: colorDe(b),
                  sub: `${t?.servicios ?? 0} serv.`,
                }
              })}
            />
          </div>
        </Ficha>
      </div>

      {/* El libro de pagos: la réplica del Excel del negocio */}
      <Ficha>
        <CabeceraFicha
          mini="Réplica del cuaderno de pagos"
          titulo="Libro de comisiones"
          extra={
            <button onClick={exportarCSV} className="chip23 inline-flex items-center gap-1.5">
              <Download className="size-3" /> Exportar CSV
            </button>
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="brand-serif px-4 py-2.5 font-normal text-muted-foreground">Fecha</th>
                {columnas.map((b) => (
                  <th key={b} className="brand-wide px-3 py-2.5 text-right text-[10px]">
                    <span className="mr-1.5 inline-block size-2 align-baseline" style={{ background: colorDe(b) }} />
                    {b}
                  </th>
                ))}
                <th className="brand-wide border-l border-border px-3 py-2.5 text-right text-[10px]">Total serv.</th>
                {columnas.map((b) => (
                  <th key={`p-${b}`} className="brand-wide px-3 py-2.5 text-right text-[10px] text-muted-foreground">
                    {b} 50%
                  </th>
                ))}
                <th className="brand-wide border-l border-border px-4 py-2.5 text-right text-[10px]">Total pago</th>
              </tr>
            </thead>
            <tbody>
              {dias.map((d) => {
                const fila = porDia.get(d)
                const totalDiaServ = columnas.reduce((s, b) => s + (fila?.get(b)?.servicios ?? 0), 0)
                const totalDiaPago = columnas.reduce((s, b) => s + (fila?.get(b)?.monto ?? 0), 0) * COMISION_PCT
                return (
                  <tr key={d} className={totalDiaServ === 0 ? "border-b border-border/60 text-muted-foreground/50" : "border-b border-border/60"}>
                    <td className="tnum whitespace-nowrap px-4 py-2">{etiquetaCorta(d)}</td>
                    {columnas.map((b) => (
                      <td key={b} className="tnum px-3 py-2 text-right">{fila?.get(b)?.servicios ?? 0}</td>
                    ))}
                    <td className="tnum border-l border-border px-3 py-2 text-right font-semibold">{totalDiaServ}</td>
                    {columnas.map((b) => {
                      const celda = fila?.get(b)
                      return (
                        <td key={`p-${b}`} className="tnum px-3 py-2 text-right">
                          {formatoSoles((celda?.monto ?? 0) * COMISION_PCT)}
                          {(celda?.sinPrecio ?? 0) > 0 && <span className="text-status-pending">*</span>}
                        </td>
                      )
                    })}
                    <td className="tnum border-l border-border px-4 py-2 text-right font-semibold">{formatoSoles(totalDiaPago)}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              {/* Totales invertidos a negro: el patrón .on del sitio. */}
              <tr className="bg-foreground text-background">
                <td className="brand-wide px-4 py-2.5 text-[10px]">Total</td>
                {columnas.map((b) => (
                  <td key={b} className="tnum px-3 py-2.5 text-right font-semibold">{totalPorBarbero.get(b)?.servicios ?? 0}</td>
                ))}
                <td className="tnum border-l border-background/25 px-3 py-2.5 text-right font-bold">{totalServicios}</td>
                {columnas.map((b) => (
                  <td key={`p-${b}`} className="tnum px-3 py-2.5 text-right font-semibold">
                    {formatoSoles((totalPorBarbero.get(b)?.monto ?? 0) * COMISION_PCT)}
                  </td>
                ))}
                <td className="tnum border-l border-background/25 px-4 py-2.5 text-right font-bold">{formatoSoles(totalPago)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        {sinPrecioTotal > 0 && (
          <p className="brand-serif border-t border-border px-4 py-2.5 text-[12px] text-muted-foreground">
            * {sinPrecioTotal} servicio{sinPrecioTotal === 1 ? "" : "s"} sin precio numérico claro ("Consultar", rangos) cuentan en el
            conteo pero no suman al pago — regístralos a mano si se cobraron.
          </p>
        )}
      </Ficha>

      {/* Citas atendidas sin barbero: sin esto, el libro paga de menos. */}
      {sinBarbero.length > 0 && (
        <Ficha>
          <CabeceraFicha
            mini="Falta saber quién atendió"
            titulo={`Sin barbero (${sinBarbero.length})`}
          />
          <ul>
            {sinBarbero.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-5 py-3 last:border-b-0">
                <div className="min-w-0 text-[13px]">
                  <span className="font-semibold">{c.services.name}</span>
                  <span className="text-muted-foreground"> · {c.clientes.nombre?.trim() || c.clientes.telefono}</span>
                  <span className="brand-serif text-muted-foreground"> · {etiquetaLarga(diaLimaDe(c.inicio_utc))}</span>
                </div>
                <div className="flex gap-1.5">
                  {BARBEROS.map((b) => (
                    <button
                      key={b}
                      disabled={asignando === c.id}
                      onClick={() => asignarBarbero(c.id, b)}
                      className="chip23 disabled:opacity-40"
                      style={{ borderColor: colorDe(b), color: colorDe(b) }}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </Ficha>
      )}
    </div>
  )
}
