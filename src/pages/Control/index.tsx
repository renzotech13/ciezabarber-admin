import { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { METODOS_PAGO, METODO_PAGO_LABEL, type MetodoPago } from "@/lib/types"
import Comisiones from "./Comisiones"
import Productos from "./Productos"
import Caja from "./Caja"
import { cicloActual, cicloDesplazado, etiquetaLarga, type Ciclo } from "./rango"
import { cn } from "@/lib/utils"

type Pestania = "comisiones" | "productos" | "caja"

/** "all" = sin filtrar, incluye lo que todavía no tiene medio de pago marcado. */
export type FiltroMetodo = MetodoPago | "all"

/**
 * La parte financiera del negocio, solo para el superadmin: el cuaderno de
 * comisiones (50% por barbero), las ventas/stock de la tienda y la caja.
 *
 * Todo se mira por mes de caja, que en este negocio va del 16 al 15 del mes
 * siguiente — no por mes calendario. El ciclo elegido manda sobre las tres
 * pestañas, así que las comisiones, las ventas y el arqueo hablan siempre
 * del mismo periodo.
 */
export default function Control() {
  const [pestania, setPestania] = useState<Pestania>("comisiones")
  const [ciclo, setCiclo] = useState<Ciclo>(() => cicloActual())
  const [metodo, setMetodo] = useState<FiltroMetodo>("all")

  const esActual = ciclo.clave === cicloActual().clave

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-6">
        <p className="brand-serif text-sm text-muted-foreground">
          Solo dueño · mes de caja {etiquetaLarga(ciclo.desde)} — {etiquetaLarga(ciclo.hasta)}
        </p>
        <h1 className="brand-display mt-1 text-[clamp(30px,4vw,44px)]">
          Control<span className="text-muted-foreground">.</span>
        </h1>
      </header>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-y border-border py-3">
        <div className="flex gap-2">
          {(
            [
              { clave: "comisiones", etiqueta: "Comisiones" },
              { clave: "productos", etiqueta: "Productos" },
              { clave: "caja", etiqueta: "Caja" },
            ] as { clave: Pestania; etiqueta: string }[]
          ).map((t) => (
            <button
              key={t.clave}
              onClick={() => setPestania(t.clave)}
              className={cn("chip23", pestania === t.clave && "on")}
            >
              {t.etiqueta}
            </button>
          ))}
        </div>

        {/* Navegador de ciclos: el mes de caja es la unidad de todo el Control. */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCiclo(cicloDesplazado(ciclo, -1))}
            aria-label="Mes de caja anterior"
            className="chip23 px-2.5"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <div className="brand-wide min-w-40 text-center text-[12px]">{ciclo.etiqueta}</div>
          <button
            onClick={() => setCiclo(cicloDesplazado(ciclo, 1))}
            disabled={esActual}
            aria-label="Mes de caja siguiente"
            className="chip23 px-2.5 disabled:opacity-30"
          >
            <ChevronRight className="size-3.5" />
          </button>
          {!esActual && (
            <button onClick={() => setCiclo(cicloActual())} className="chip23">
              Actual
            </button>
          )}
        </div>
      </div>

      {/* Filtro por cómo entró la plata. La caja siempre muestra los tres
          medios separados, así que ahí no aplica. */}
      {pestania !== "caja" && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="brand-serif mr-1 text-[13px] text-muted-foreground">Cobrado con</span>
          <button onClick={() => setMetodo("all")} className={cn("chip23", metodo === "all" && "on")}>
            Todos
          </button>
          {METODOS_PAGO.map((m) => (
            <button key={m} onClick={() => setMetodo(m)} className={cn("chip23", metodo === m && "on")}>
              {METODO_PAGO_LABEL[m]}
            </button>
          ))}
        </div>
      )}

      {pestania === "comisiones" ? (
        <Comisiones rango={ciclo} metodo={metodo} />
      ) : pestania === "productos" ? (
        <Productos rango={ciclo} metodo={metodo} />
      ) : (
        <Caja ciclo={ciclo} />
      )}
    </div>
  )
}
