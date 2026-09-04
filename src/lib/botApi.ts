import { supabase } from "./supabase"
import type { Barbero, Cita, CitaEstado, MetodoPago, Mensaje } from "./types"

const BASE_URL = import.meta.env.VITE_BOT_API_URL as string | undefined

/**
 * Enviar por WhatsApp no se puede hacer desde el navegador: el token de
 * Meta vive solo en el bot. Este módulo habla con los endpoints /admin/*
 * del bot, que validan el JWT de Supabase y exigen rol staff.
 */
export class BotApiError extends Error {
  readonly code: string

  constructor(message: string, code: string) {
    super(message)
    this.name = "BotApiError"
    this.code = code
  }
}

const MENSAJES_ERROR: Record<string, string> = {
  sin_configurar: "Falta configurar VITE_BOT_API_URL para conectar con el bot.",
  sin_sesion: "Tu sesión expiró. Vuelve a iniciar sesión.",
  missing_token: "Tu sesión expiró. Vuelve a iniciar sesión.",
  invalid_token: "Tu sesión expiró. Vuelve a iniciar sesión.",
  forbidden: "Tu usuario no tiene permisos de staff.",
  conversacion_no_encontrada: "Esa conversación ya no existe.",
  cita_no_encontrada: "Esa cita ya no existe.",
  bloqueo_no_encontrado: "Ese bloqueo ya no existe.",
  plantilla_no_encontrada: "Esa multimedia ya no existe.",
  whatsapp_send_failed: "WhatsApp rechazó el envío. Revisa los logs del bot.",
  red: "No se pudo conectar con el bot. Revisa que esté en línea.",
}

/** Igual que post(), pero para consultas de solo lectura al bot. */
export async function getDisponibilidad(params: {
  servicio_id: string
  fecha_desde: string
  fecha_hasta?: string
  barbero?: string
}): Promise<{ fecha: string; horas: string[] }[]> {
  if (!BASE_URL) throw new BotApiError(MENSAJES_ERROR.sin_configurar, "sin_configurar")
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new BotApiError(MENSAJES_ERROR.sin_sesion, "sin_sesion")

  const query = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v != null) as [string, string][],
  )
  let res: Response
  try {
    res = await fetch(`${BASE_URL}/admin/disponibilidad?${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    throw new BotApiError(MENSAJES_ERROR.red, "red")
  }
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { error?: string } | null
    const code = payload?.error ?? "desconocido"
    throw new BotApiError(MENSAJES_ERROR[code] ?? "No se pudo consultar la disponibilidad.", code)
  }
  return res.json()
}

async function post<T>(path: string, body: unknown): Promise<T> {
  if (!BASE_URL) throw new BotApiError(MENSAJES_ERROR.sin_configurar, "sin_configurar")

  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new BotApiError(MENSAJES_ERROR.sin_sesion, "sin_sesion")

  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })
  } catch {
    throw new BotApiError(MENSAJES_ERROR.red, "red")
  }

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    const code = typeof json.error === "string" ? json.error : "desconocido"
    // El bot manda `mensaje` cuando el detalle importa para el usuario
    // (p. ej. la ventana de 24h cerrada); si no, se traduce el código.
    const texto =
      typeof json.mensaje === "string" ? json.mensaje : (MENSAJES_ERROR[code] ?? "No se pudo completar la acción.")
    throw new BotApiError(texto, code)
  }
  return json as T
}

export function enviarMensajeHumano(conversacionId: string, texto: string) {
  return post<{ mensaje: Mensaje }>("/admin/mensajes", { conversacionId, texto })
}

export function enviarPlantillaMensaje(conversacionId: string, plantillaId: string) {
  return post<{ mensaje: Mensaje }>("/admin/mensajes", { conversacionId, plantillaId })
}

export function enviarPromocion(params: { clienteIds: string[]; plantilla: string; parametros?: string[] }) {
  return post<{ enviadas: number; fallidas: { clienteId: string; motivo: string }[] }>("/admin/promociones", params)
}

/**
 * Pasa por el bot (no un update directo a Supabase) para que, al cancelar,
 * también borre el evento de Calendar — el navegador nunca tiene las
 * credenciales de la service account.
 */
export function actualizarEstadoCita(citaId: string, estado: CitaEstado, metodoPago?: MetodoPago) {
  return post<{ cita: Cita }>(`/admin/citas/${citaId}/estado`, {
    estado,
    ...(metodoPago ? { metodo_pago: metodoPago } : {}),
  })
}

/** Lo que el barbero anota después de atender (el corte, el tono, la máquina). */
export function guardarAtencion(citaId: string, atencionNotas: string) {
  return post<{ ok: true }>(`/admin/citas/${citaId}/atencion`, { atencion_notas: atencionNotas })
}

/** Mover de horario: rehace el evento de Calendar y revalida el hueco. */
export function reagendarCita(citaId: string, fecha: string, hora: string) {
  return post<{ cita: Cita }>(`/admin/citas/${citaId}/reagendar`, { fecha, hora })
}

/** Cita cargada a mano (cliente que llegó sin reservar). Nace confirmada. */
export function crearCitaManual(datos: {
  servicio_id: string
  fecha: string
  hora: string
  nombre_cliente: string
  telefono_cliente: string
  barbero?: string
  notas?: string
}) {
  return post<{ cita: Cita }>("/admin/citas", datos)
}

/**
 * Servicio ya atendido (el cliente que llegó sin reserva). Nace completada y
 * con su medio de pago: entra directo al libro de comisiones y a la caja.
 */
export function registrarServicioAtendido(datos: {
  servicio_id: string
  barbero: Barbero
  metodo_pago: MetodoPago
  fecha: string
  hora: string
  nombre_cliente?: string
  telefono_cliente?: string
  notas?: string
}) {
  return post<{ cita: Cita }>("/admin/citas/atendida", datos)
}

/** Mismo motivo que actualizarEstadoCita: si el bloqueo vino de Calendar, hay que borrar el evento también. */
export function eliminarBloqueo(bloqueoId: string) {
  return post<Record<string, never>>(`/admin/bloqueos/${bloqueoId}/eliminar`, {})
}
