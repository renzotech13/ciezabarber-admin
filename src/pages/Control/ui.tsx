import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/** Tarjeta blanca de borde 1px — la .svc del sitio convertida en contenedor. */
export function Ficha({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("border border-border bg-card", className)}>{children}</section>
}

export function CabeceraFicha({ mini, titulo, extra }: { mini: string; titulo: string; extra?: ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-4 border-b border-border px-5 pb-4 pt-5">
      <div>
        <p className="brand-serif text-[13px] text-muted-foreground">{mini}</p>
        <h2 className="brand-display mt-1 text-[19px]">{titulo}</h2>
      </div>
      {extra}
    </header>
  )
}

/**
 * Cifra grande al estilo del monto del paso de pago: Archivo ancha con la
 * etiqueta en serif debajo. `marca` pinta un filete de color de serie arriba.
 */
export function Tile({ etiqueta, valor, detalle, marca }: {
  etiqueta: string
  valor: string
  detalle?: string
  marca?: string
}) {
  return (
    <div className="border border-border bg-card px-5 pb-4 pt-4">
      {marca && <div className="mb-3 h-[3px] w-7" style={{ background: marca }} />}
      <div className="brand-wide tnum text-[26px] leading-none">{valor}</div>
      <div className="brand-serif mt-2 text-[13px] text-muted-foreground">
        {etiqueta}
        {detalle && <span className="text-foreground/60"> · {detalle}</span>}
      </div>
    </div>
  )
}

export function LeyendaSerie({ items }: { items: { etiqueta: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map((s) => (
        <span key={s.etiqueta} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="inline-block size-2.5" style={{ background: s.color }} />
          {s.etiqueta}
        </span>
      ))}
    </div>
  )
}
