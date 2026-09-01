import { useEffect, useRef, useState, type ReactNode } from "react"

/**
 * Gráficos SVG propios, dibujados con el lenguaje del sitio: reglas de 1px en
 * --border, marcas finas con separación de 2px, números tabulares y serif para
 * las notas. Sin librería de charts — el look no sale de un default ajeno.
 *
 * Los colores de serie llegan por props (var(--chart-N) o hex validado); el
 * texto siempre va en tinta de texto, nunca en el color de la serie.
 */

function useAncho<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [ancho, setAncho] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new ResizeObserver(([entry]) => setAncho(entry.contentRect.width))
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return { ref, ancho }
}

type TooltipState = { x: number; y: number; contenido: ReactNode } | null

function Tooltip({ estado }: { estado: TooltipState }) {
  if (!estado) return null
  return (
    <div
      className="pointer-events-none absolute z-10 border border-foreground bg-card px-3 py-2 text-xs shadow-none"
      style={{ left: estado.x, top: estado.y, transform: "translate(-50%, calc(-100% - 10px))" }}
    >
      {estado.contenido}
    </div>
  )
}

/** Ticks enteros "bonitos" para conteos y montos chicos. */
function ticksEnteros(max: number, cantidad = 4): number[] {
  // El dinero trae decimales (S/ 4.20): sin el ceil, el último tick podía
  // quedar por DEBAJO del máximo y el pico se dibujaba fuera del eje.
  const tope = Math.ceil(max)
  if (tope <= 0) return [0, 1]
  const paso = Math.max(1, Math.ceil(tope / cantidad))
  const ticks: number[] = []
  for (let v = 0; v <= tope + paso - 1; v += paso) ticks.push(v)
  return ticks
}

export type SegmentoBarra = { clave: string; valor: number; color: string }
export type DiaBarras = { etiqueta: string; etiquetaLarga: string; segmentos: SegmentoBarra[] }

/** Barras verticales apiladas (servicios por día, un color fijo por barbero). */
export function GraficoBarrasApiladas({ dias, formatoTooltip }: {
  dias: DiaBarras[]
  formatoTooltip?: (segmento: SegmentoBarra) => string
}) {
  const { ref, ancho } = useAncho<HTMLDivElement>()
  const [tooltip, setTooltip] = useState<TooltipState>(null)

  const alto = 190
  const margen = { arriba: 8, abajo: 22, izq: 26, der: 4 }
  const anchoUtil = Math.max(0, ancho - margen.izq - margen.der)
  const altoUtil = alto - margen.arriba - margen.abajo

  const max = Math.max(1, ...dias.map((d) => d.segmentos.reduce((s, x) => s + x.valor, 0)))
  const ticks = ticksEnteros(max)
  const maxEscala = ticks[ticks.length - 1] || 1
  const escalaY = (v: number) => altoUtil * (v / maxEscala)

  const paso = dias.length > 0 ? anchoUtil / dias.length : 0
  const anchoBarra = Math.max(4, Math.min(26, paso * 0.55))
  // Con muchos días no caben todas las fechas: se etiqueta cada n-ésimo.
  const cadaN = Math.max(1, Math.ceil(dias.length / Math.max(1, Math.floor(anchoUtil / 44))))

  return (
    <div ref={ref} className="relative">
      <Tooltip estado={tooltip} />
      <svg width="100%" height={alto} role="img" aria-label="Servicios por día">
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={margen.izq} x2={ancho - margen.der}
              y1={margen.arriba + altoUtil - escalaY(t)} y2={margen.arriba + altoUtil - escalaY(t)}
              stroke="var(--border)" strokeWidth={1}
            />
            <text
              x={margen.izq - 6} y={margen.arriba + altoUtil - escalaY(t) + 3}
              textAnchor="end" fontSize={10} className="tnum" fill="var(--muted-foreground)"
            >
              {t}
            </text>
          </g>
        ))}
        {dias.map((dia, i) => {
          const x = margen.izq + paso * i + (paso - anchoBarra) / 2
          let acumulado = 0
          return (
            <g key={dia.etiqueta}>
              {dia.segmentos.filter((s) => s.valor > 0).map((seg) => {
                const h = Math.max(0, escalaY(acumulado + seg.valor) - escalaY(acumulado) - 2)
                const y = margen.arriba + altoUtil - escalaY(acumulado + seg.valor)
                acumulado += seg.valor
                return (
                  <rect
                    key={seg.clave}
                    x={x} y={y} width={anchoBarra} height={h}
                    fill={seg.color}
                    onMouseEnter={(e) => {
                      const contenedor = e.currentTarget.ownerSVGElement?.parentElement
                      if (!contenedor) return
                      const caja = contenedor.getBoundingClientRect()
                      setTooltip({
                        x: e.clientX - caja.left,
                        y: y,
                        contenido: (
                          <span>
                            <span className="brand-serif text-muted-foreground">{dia.etiquetaLarga}</span>
                            <br />
                            <b>{seg.clave}</b>: <span className="tnum">{formatoTooltip ? formatoTooltip(seg) : seg.valor}</span>
                          </span>
                        ),
                      })
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  />
                )
              })}
              {i % cadaN === 0 && (
                <text
                  x={x + anchoBarra / 2} y={alto - 6}
                  textAnchor="middle" fontSize={10} className="tnum" fill="var(--muted-foreground)"
                >
                  {dia.etiqueta}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export type ItemBarraH = { etiqueta: string; valor: number; textoValor: string; color: string; sub?: string }

/** Barras horizontales con etiqueta directa (comisión por barbero, top productos). */
export function GraficoBarrasH({ items }: { items: ItemBarraH[] }) {
  const { ref, ancho } = useAncho<HTMLDivElement>()
  const max = Math.max(1, ...items.map((i) => i.valor))
  const altoFila = 40
  const margenIzq = 0

  return (
    <div ref={ref}>
      <svg width="100%" height={items.length * altoFila} role="img" aria-label="Comparativa">
        {items.map((item, i) => {
          const y = i * altoFila
          const anchoBarra = Math.max(2, (ancho - margenIzq) * (item.valor / max) * 0.72)
          return (
            <g key={item.etiqueta}>
              <text x={margenIzq} y={y + 12} fontSize={11} fontWeight={600} fill="var(--foreground)">
                {item.etiqueta}
                {item.sub && (
                  <tspan fontSize={10} fontWeight={400} fill="var(--muted-foreground)">
                    {"  "}{item.sub}
                  </tspan>
                )}
              </text>
              <rect x={margenIzq} y={y + 18} width={item.valor > 0 ? anchoBarra : 0} height={12} fill={item.color} />
              <line x1={margenIzq} x2={margenIzq} y1={y + 16} y2={y + 32} stroke="var(--foreground)" strokeWidth={1} />
              <text
                x={margenIzq + (item.valor > 0 ? anchoBarra : 0) + 8} y={y + 28}
                fontSize={11} className="tnum" fill="var(--foreground)"
              >
                {item.textoValor}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export type PuntoLinea = { etiqueta: string; etiquetaLarga: string; valor: number }

/** Línea de tendencia (ventas por día) con crosshair al pasar el mouse. */
export function GraficoLinea({ puntos, formatoValor }: {
  puntos: PuntoLinea[]
  formatoValor: (v: number) => string
}) {
  const { ref, ancho } = useAncho<HTMLDivElement>()
  const [activo, setActivo] = useState<number | null>(null)

  const alto = 190
  const margen = { arriba: 10, abajo: 22, izq: 40, der: 10 }
  const anchoUtil = Math.max(0, ancho - margen.izq - margen.der)
  const altoUtil = alto - margen.arriba - margen.abajo

  const max = Math.max(1, ...puntos.map((p) => p.valor))
  const ticks = ticksEnteros(max)
  const maxEscala = ticks[ticks.length - 1] || 1

  const x = (i: number) => margen.izq + (puntos.length > 1 ? (anchoUtil * i) / (puntos.length - 1) : anchoUtil / 2)
  const y = (v: number) => margen.arriba + altoUtil - altoUtil * (v / maxEscala)

  const camino = puntos.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.valor)}`).join(" ")
  const area = puntos.length > 1
    ? `${camino} L${x(puntos.length - 1)},${margen.arriba + altoUtil} L${x(0)},${margen.arriba + altoUtil} Z`
    : ""
  const cadaN = Math.max(1, Math.ceil(puntos.length / Math.max(1, Math.floor(anchoUtil / 44))))

  return (
    <div ref={ref} className="relative">
      {activo != null && puntos[activo] && (
        <Tooltip
          estado={{
            x: x(activo),
            y: y(puntos[activo].valor),
            contenido: (
              <span>
                <span className="brand-serif text-muted-foreground">{puntos[activo].etiquetaLarga}</span>
                <br />
                <b className="tnum">{formatoValor(puntos[activo].valor)}</b>
              </span>
            ),
          }}
        />
      )}
      <svg
        width="100%" height={alto} role="img" aria-label="Tendencia por día"
        onMouseMove={(e) => {
          if (puntos.length === 0 || anchoUtil <= 0) return
          const caja = e.currentTarget.getBoundingClientRect()
          const px = e.clientX - caja.left - margen.izq
          const i = Math.round((px / anchoUtil) * (puntos.length - 1))
          setActivo(Math.max(0, Math.min(puntos.length - 1, i)))
        }}
        onMouseLeave={() => setActivo(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={margen.izq} x2={ancho - margen.der} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} />
            <text x={margen.izq - 6} y={y(t) + 3} textAnchor="end" fontSize={10} className="tnum" fill="var(--muted-foreground)">
              {formatoValor(t)}
            </text>
          </g>
        ))}
        {area && <path d={area} fill="var(--foreground)" opacity={0.05} />}
        {puntos.length > 1 && <path d={camino} fill="none" stroke="var(--foreground)" strokeWidth={2} />}
        {puntos.length === 1 && <circle cx={x(0)} cy={y(puntos[0]!.valor)} r={4} fill="var(--foreground)" />}
        {activo != null && puntos[activo] && (
          <g>
            <line
              x1={x(activo)} x2={x(activo)}
              y1={margen.arriba} y2={margen.arriba + altoUtil}
              stroke="var(--muted-foreground)" strokeWidth={1} strokeDasharray="3 3"
            />
            <circle cx={x(activo)} cy={y(puntos[activo].valor)} r={4} fill="var(--foreground)" stroke="var(--card)" strokeWidth={2} />
          </g>
        )}
        {puntos.map((p, i) =>
          i % cadaN === 0 ? (
            <text key={p.etiqueta} x={x(i)} y={alto - 6} textAnchor="middle" fontSize={10} className="tnum" fill="var(--muted-foreground)">
              {p.etiqueta}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  )
}
