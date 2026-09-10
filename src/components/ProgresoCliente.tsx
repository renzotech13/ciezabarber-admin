import { useEffect, useState } from "react"
import { Sparkles } from "lucide-react"
import {
  buscarClientePorTelefono,
  calcularProgreso,
  contarCortes,
  normalizarTelefono,
  obtenerRecompensasActivas,
} from "@/lib/clienteBusqueda"

type Estado =
  | { tipo: "nada" }
  | { tipo: "nuevo" }
  | { tipo: "conocido"; nombre: string | null; cortes: number; faltan: number | null; siguiente: string | null }

/**
 * Debajo del campo de teléfono: en cuanto el número coincide con un cliente
 * ya registrado, muestra cuántos cortes lleva y qué le falta para el
 * siguiente premio.
 *
 * Es la otra mitad del pedido junto con ClienteCombobox — reconocer a un
 * cliente frecuente EN EL MOMENTO de registrarlo (por nombre o pegando su
 * número) es lo que hace fácil aplicarle el beneficio del 5º o el 10º
 * corte sin tener que ir a buscarlo en otro lado.
 */
export function ProgresoCliente({ telefono }: { telefono: string }) {
  const [estado, setEstado] = useState<Estado>({ tipo: "nada" })

  useEffect(() => {
    const digitos = telefono.replace(/\D/g, "")
    // Mismo umbral que ya usan estos formularios para dar el teléfono por
    // completo (8-9 dígitos locales, o con el 51 delante).
    if (digitos.length < 6) {
      setEstado({ tipo: "nada" })
      return
    }
    let activo = true
    async function cargar() {
      const cliente = await buscarClientePorTelefono(normalizarTelefono(telefono))
      if (!activo) return
      if (!cliente) {
        setEstado({ tipo: "nuevo" })
        return
      }
      const [cortes, recompensas] = await Promise.all([contarCortes(cliente.id), obtenerRecompensasActivas()])
      if (!activo) return
      const progreso = calcularProgreso(cortes, recompensas)
      setEstado({
        tipo: "conocido",
        nombre: cliente.nombre,
        cortes,
        faltan: progreso?.faltan ?? null,
        siguiente: progreso?.siguiente.titulo ?? null,
      })
    }
    cargar()
    return () => {
      activo = false
    }
  }, [telefono])

  if (estado.tipo === "nada") return null

  if (estado.tipo === "nuevo") {
    return <p className="brand-serif text-[12px] text-muted-foreground">Cliente nuevo: se le crea la ficha al registrar.</p>
  }

  return (
    <p className="brand-serif flex flex-wrap items-center gap-x-1.5 text-[12px] text-muted-foreground">
      <Sparkles className="size-3.5 shrink-0 text-[var(--status-confirmed)]" />
      {estado.nombre ? `${estado.nombre} lleva` : "Lleva"}{" "}
      <span className="font-semibold text-foreground">{estado.cortes}</span> {estado.cortes === 1 ? "corte" : "cortes"}
      {estado.siguiente ? (
        <>
          {" "}
          · faltan <span className="font-semibold text-foreground">{estado.faltan}</span> para: {estado.siguiente}
        </>
      ) : (
        estado.cortes > 0 && " · ya alcanzó todas las recompensas"
      )}
    </p>
  )
}
