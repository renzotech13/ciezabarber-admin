import { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { METODOS_PAGO, METODO_PAGO_LABEL, type MetodoPago } from "@/lib/types"
import Comisiones from "./Comisiones"
import Productos from "./Productos"
import Caja from "./Caja"
import {
  TIPOS_PERIODO,
  cicloDe,
  periodoDe,
  esPeriodoActual,
  etiquetaLarga,
  periodoActual,
  periodoDesplazado,
  type Periodo,
  type TipoPeriodo,
} from "./rango"
import { cn } from "@/lib/utils"

type Pestania = "comisiones" | "productos" | "caja"

/** "all" = sin filtrar, incluye lo que todavía no tiene medio de pago marcado. */
export type FiltroMetodo = MetodoPago | "all"

/**
 * La parte financiera del negocio, solo para el superadmin: el cuaderno de
 * comisiones (50% por barbero), las ventas/stock de la tienda y la caja.
 *
 * El periodo se elige arriba (día, semana, mes o de quincena a quincena, que
 * es el mes de caja del negocio: del 16 al 15) y manda sobre las pestañas,
 * así que comisiones y ventas hablan siempre del mismo tramo. Las flechas
 * mueven ese mismo periodo hacia atrás y adelante.
 *
 * La caja es la excepción: se arquea siempre por mes de caja, así que toma
 * el ciclo en el que cae el periodo elegido.
 */
export default function Control() {
  const [pestania, setPestania] = useState<Pestania>("comisiones")
  // El periodo es estado, no derivado: se calcula con el "hoy" de Lima del
  // momento del click, así que volver a "Actual" refresca de verdad las
  // fechas aunque la pestaña lleve horas abierta.
  const [periodo, setPeriodo] = useState<Periodo>(() => periodoActual("ciclo"))
  const [metodo, setMetodo] = useState<FiltroMetodo>("all")

  const esActual = esPeriodoActual(periodo)
  const ciclo = cicloDe(periodo.desde)

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-6">
        <p className="brand-serif text-sm text-muted-foreground">
          Solo dueño ·{" "}
          {periodo.desde === periodo.hasta
            ? etiquetaLarga(periodo.desde)
            : `${etiquetaLarga(periodo.desde)} — ${etiquetaLarga(periodo.hasta)}`}
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

        {/* Qué tan grande es el tramo que se mira. */}
        <div className="flex flex-wrap gap-2">
          {TIPOS_PERIODO.map((t) => (
            <button
              key={t.clave}
              onClick={() =>
                // Si estás parado en el periodo en curso, cambiar de tamaño te
                // deja en el que corre ahora; si estabas mirando atrás, se
                // queda en la misma fecha para no perderte el tramo.
                setPeriodo(
                  esActual ? periodoActual(t.clave as TipoPeriodo) : periodoDe(t.clave as TipoPeriodo, periodo.desde),
                )
              }
              className={cn("chip23", periodo.tipo === t.clave && "on")}
            >
              {t.etiqueta}
            </button>
          ))}
        </div>
      </div>

      {/* Y en qué tramo concreto se está parado: las flechas lo mueven. */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setPeriodo(periodoDesplazado(periodo, -1))}
          aria-label="Periodo anterior"
          className="chip23 px-2.5"
        >
          <ChevronLeft className="size-3.5" />
        </button>
        <div className="brand-wide min-w-52 text-center text-[12px]">{periodo.etiqueta}</div>
        <button
          onClick={() => setPeriodo(periodoDesplazado(periodo, 1))}
          disabled={esActual}
          aria-label="Periodo siguiente"
          className="chip23 px-2.5 disabled:opacity-30"
        >
          <ChevronRight className="size-3.5" />
        </button>
        {!esActual && (
          <button onClick={() => setPeriodo(periodoActual(periodo.tipo))} className="chip23">
            Actual
          </button>
        )}
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
        <Comisiones rango={periodo} metodo={metodo} />
      ) : pestania === "productos" ? (
        <Productos rango={periodo} metodo={metodo} />
      ) : (
        <Caja ciclo={ciclo} />
      )}
    </div>
  )
}
