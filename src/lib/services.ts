import { useEffect, useId, useState } from "react"
import { supabase } from "@/lib/supabase"

/**
 * Nombres de los servicios, cacheados y al día.
 *
 * El nombre del canal lleva un id único por instancia a propósito: Supabase
 * devuelve el canal YA EXISTENTE cuando se le pide uno con un nombre repetido,
 * y suscribirse dos veces sobre él lanza ("cannot add postgres_changes
 * callbacks after subscribe()"), lo que tumba el árbol de React entero y deja
 * la página en blanco. Pasó al montar un consumidor global (el aviso de
 * reservas nuevas) junto a los de cada página.
 */
export function useServiceNames() {
  const [names, setNames] = useState<Record<string, string>>({})
  const instanciaId = useId()

  useEffect(() => {
    let active = true

    async function load() {
      const { data } = await supabase.from("services").select("id,name")
      if (active && data) {
        setNames(Object.fromEntries(data.map((s) => [s.id, s.name as string])))
      }
    }
    load()

    const channel = supabase
      .channel(`service-names${instanciaId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "services" }, () => {
        load()
      })
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [instanciaId])

  function serviceName(id: string): string {
    return names[id] ?? id
  }

  return { serviceName }
}
