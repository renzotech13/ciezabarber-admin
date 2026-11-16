import { useState } from "react"
import { useAuth } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { SimuladorCorte } from "@/components/Simulador/SimuladorCorte"
import { CatalogoCortes } from "@/components/Simulador/CatalogoCortes"

/** Panel de escritorio: simular con un cliente o armar el catálogo de cortes de referencia (solo staff). */
export default function Simulador() {
  const { role } = useAuth()
  const puedeEditar = role === "staff" || role === "superadmin"
  const [vista, setVista] = useState<"simular" | "catalogo">("simular")

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Simulador de cortes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Según la forma del rostro y del cráneo del cliente, le recomienda cortes del catálogo con la foto de alguien de
          rasgos parecidos.
        </p>
      </div>
      {puedeEditar && (
        <div className="flex gap-2">
          {(
            [
              ["simular", "Simular"],
              ["catalogo", "Catálogo de cortes"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setVista(id)}
              className={cn(
                "brand-wide border px-4 py-2 text-xs transition-colors",
                vista === id ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {vista === "catalogo" && puedeEditar ? <CatalogoCortes /> : <SimuladorCorte />}
    </div>
  )
}
