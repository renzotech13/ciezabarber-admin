import { supabase } from "@/lib/supabase"
import type { Recompensa } from "@/lib/types"

/**
 * "987654321" → "51987654321" — mismo criterio en toda la app.
 *
 * Sin el prefijo, un walk-in registrado desde el panel y una reserva hecha
 * por la web o WhatsApp para el MISMO número terminaban en dos fichas de
 * cliente distintas (findOrCreateByPhone en el bot compara el teléfono tal
 * cual, sin normalizar). Eso partía el historial de cortes de una persona
 * en dos, justo lo que este archivo existe para evitar.
 */
export function normalizarTelefono(raw: string): string {
  const digitos = raw.replace(/\D/g, "")
  return digitos.startsWith("51") ? digitos : `51${digitos}`
}

const MIN_CARACTERES_BUSQUEDA = 3

export type ClienteSugerido = {
  id: string
  nombre: string | null
  telefono: string
  cortes: number
}

/**
 * Sugerencias de clientes ya registrados, por nombre o teléfono. Menos de 3
 * caracteres no busca: con nombres comunes ("Ana", "Jose") dos letras traen
 * demasiado ruido para ser útil.
 */
export async function buscarClientes(consulta: string): Promise<ClienteSugerido[]> {
  const q = consulta.trim()
  if (q.length < MIN_CARACTERES_BUSQUEDA) return []

  const soloDigitos = q.replace(/\D/g, "")
  const filtro =
    soloDigitos.length >= MIN_CARACTERES_BUSQUEDA
      ? `nombre.ilike.%${q}%,telefono.ilike.%${soloDigitos}%`
      : `nombre.ilike.%${q}%`

  const { data, error } = await supabase.from("clientes").select("id, nombre, telefono").or(filtro).order("nombre").limit(6)
  if (error || !data) return []

  // El conteo va en paralelo y aparte (head:true, no trae filas): la lista
  // es corta (máx. 6), así que no vale la pena una vista o un RPC solo
  // para esto.
  return Promise.all(data.map(async (c) => ({ ...c, cortes: await contarCortes(c.id) })))
}

/** Cuántos servicios completados tiene ese cliente — la base del programa de fidelidad. */
export async function contarCortes(clienteId: string): Promise<number> {
  const { count } = await supabase
    .from("citas")
    .select("id", { count: "exact", head: true })
    .eq("cliente_id", clienteId)
    .eq("estado", "completada")
  return count ?? 0
}

/** El cliente exacto detrás de ese teléfono (ya normalizado), si ya existe. */
export async function buscarClientePorTelefono(telefonoNormalizado: string): Promise<{ id: string; nombre: string | null } | null> {
  const { data } = await supabase.from("clientes").select("id, nombre").eq("telefono", telefonoNormalizado).maybeSingle()
  return data
}

export async function obtenerRecompensasActivas(): Promise<Recompensa[]> {
  const { data } = await supabase.from("recompensas").select("*").eq("activo", true).order("cortes_requeridos")
  return (data as Recompensa[] | null) ?? []
}

/** La próxima meta y cuánto falta, o null si ya alcanzó todas las recompensas activas. */
export function calcularProgreso(cortes: number, recompensas: Recompensa[]): { siguiente: Recompensa; faltan: number } | null {
  const siguiente = recompensas.find((r) => r.cortes_requeridos > cortes)
  return siguiente ? { siguiente, faltan: siguiente.cortes_requeridos - cortes } : null
}
