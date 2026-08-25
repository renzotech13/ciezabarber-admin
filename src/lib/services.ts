import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

export function useServiceNames() {
  const [names, setNames] = useState<Record<string, string>>({})

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
      .channel("service-names")
      .on("postgres_changes", { event: "*", schema: "public", table: "services" }, () => {
        load()
      })
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [])

  function serviceName(id: string): string {
    return names[id] ?? id
  }

  return { serviceName }
}
