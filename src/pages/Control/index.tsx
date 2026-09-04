import { useState } from "react"
import Comisiones from "./Comisiones"
import Productos from "./Productos"
import Caja from "./Caja"
import { RANGOS, type RangoClave, calcularRango, etiquetaLarga } from "./rango"
import { cn } from "@/lib/utils"

type Pestania = "comisiones" | "productos" | "caja"

/**
 * La parte financiera del negocio, solo para el superadmin: el cuaderno de
 * comisiones (50% por barbero) y las ventas/stock de la tienda. La cabecera
 * habla el idioma de la portada: mini en serif, titular extendido, chips.
 */
export default function Control() {
  const [pestania, setPestania] = useState<Pestania>("comisiones")
  const [rangoClave, setRangoClave] = useState<RangoClave>("quincena")
  // El rango es estado, no derivado: calcularRango captura el "hoy" de Lima
  // al momento del click, así que hasta repetir el chip activo refresca las
  // fechas (una sesión abierta de madrugada no se queda con el hoy de ayer).
  const [rango, setRango] = useState(() => calcularRango("quincena"))

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-6">
        <p className="brand-serif text-sm text-muted-foreground">Solo dueño · {etiquetaLarga(rango.desde)} — {etiquetaLarga(rango.hasta)}</p>
        <h1 className="brand-display mt-1 text-[clamp(30px,4vw,44px)]">
          Control<span className="text-muted-foreground">.</span>
        </h1>
      </header>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-y border-border py-3">
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
        <div className="flex flex-wrap gap-2">
          {RANGOS.map((r) => (
            <button
              key={r.clave}
              onClick={() => {
                setRangoClave(r.clave)
                setRango(calcularRango(r.clave))
              }}
              className={cn("chip23", rangoClave === r.clave && "on")}
            >
              {r.etiqueta}
            </button>
          ))}
        </div>
      </div>

      {pestania === "comisiones" ? (
        <Comisiones rango={rango} />
      ) : pestania === "productos" ? (
        <Productos rango={rango} />
      ) : (
        // La caja es del turno vivo, no del rango de fechas de arriba.
        <Caja />
      )}
    </div>
  )
}
