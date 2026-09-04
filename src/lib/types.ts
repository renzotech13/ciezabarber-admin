export type BookingStatus = "pending" | "confirmed" | "cancelled" | "completed"

export type Booking = {
  id: string
  customer_name: string
  phone: string
  service_ids: string[]
  booking_date: string
  booking_time: string
  first_visit: boolean | null
  comment: string | null
  status: BookingStatus
  created_at: string
  updated_at: string
}

export const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  cancelled: "Cancelada",
  completed: "Completada",
}

export type BookingGroup = "Principales" | "Complementarios" | "Opcionales"
export const BOOKING_GROUPS: BookingGroup[] = ["Principales", "Complementarios", "Opcionales"]

export type ServiceCategory = {
  id: string
  icon: string
  title: string
  description: string
  images: string[]
  sort_order: number
  active: boolean
  created_at: string
  updated_at: string
}

export type Service = {
  id: string
  category_id: string
  booking_group: BookingGroup
  name: string
  duration: string
  price: string
  description: string
  sort_order: number
  active: boolean
  deposit_amount: number | null
  created_at: string
  updated_at: string
}

// Categorías de filtro que usa la tienda del sitio (web/assets/tienda.js) —
// tocar los dos lados si se agrega o quita una.
export const PRODUCT_TAGS = [
  { value: "shampoos", label: "Shampoos & acondicionadores" },
  { value: "tratamientos", label: "Tratamientos" },
  { value: "estilismo", label: "Estilismo" },
  { value: "hombre", label: "Cuidado del hombre" },
  { value: "packs", label: "Dúos & tríos" },
] as const
export type ProductTag = (typeof PRODUCT_TAGS)[number]["value"]

export type Product = {
  id: string
  name: string
  price: number
  description: string
  image_url: string | null
  active: boolean
  sort_order: number
  linea: string | null
  tags: ProductTag[]
  stock: number
  created_at: string
  updated_at: string
}

/** Venta manual de producto registrada desde Control (solo superadmin).
 *  El trigger de la BD descuenta el stock al insertar y lo repone al anular. */
export type VentaProducto = {
  id: string
  producto_id: string
  cantidad: number
  precio_unitario: number
  vendido_at: string
  nota: string | null
  registrado_por: string | null
  created_at: string
}

export type SiteContent = {
  id: number
  logo_url: string | null
  logo_header_height: number
  logo_footer_height: number
  hero_eyebrow: string
  hero_title: string
  hero_subtitle: string
  hero_image_url: string | null
  about_eyebrow: string
  about_title: string
  about_body: string
  about_image_big: string | null
  about_image_small1: string | null
  about_image_small2: string | null
  belleza_image_url: string | null
  salon_image_url: string | null
  academia_image_url: string | null
  compare_before_image: string | null
  compare_after_image: string | null
  footer_tagline: string
  updated_at: string
}

export type Testimonial = {
  id: string
  avatar_url: string | null
  name: string
  service: string
  quote: string
  sort_order: number
  active: boolean
  created_at: string
  updated_at: string
}

export type ProfileRole = "staff" | "alumna" | "superadmin" | "barbero"

export type Profile = {
  id: string
  role: ProfileRole
  full_name: string | null
  phone: string | null
  created_at: string
}

/* ---------- CRM: conversaciones de WhatsApp ---------- */

/**
 * 'activa' = el bot responde. 'escalada' = un humano tomó la conversación
 * y el bot se calla (lo aplica el bot en handleMessage.ts). 'cerrada' =
 * archivada, tampoco responde.
 */
export type ConversacionEstado = "activa" | "escalada" | "cerrada"

/** 'humano' es una respuesta escrita por el staff desde este panel. */
export type RolMensaje = "user" | "assistant" | "humano"

export type Cliente = {
  id: string
  telefono: string
  nombre: string | null
  email: string | null
  notas: string | null
  created_at: string
  updated_at: string
}

export type TipoMedia = "image" | "video" | "audio" | "document"

export type Mensaje = {
  id: string
  conversacion_id: string
  rol: RolMensaje
  contenido: string
  wa_message_id: string | null
  media_url: string | null
  media_type: TipoMedia | null
  created_at: string
}

export type PlantillaMedia = {
  id: string
  nombre: string
  tipo: TipoMedia
  storage_path: string
  descripcion_uso: string
  caption: string | null
  activo: boolean
  created_at: string
  updated_at: string
}

export const TIPO_MEDIA_LABEL: Record<TipoMedia, string> = {
  image: "Imagen",
  video: "Video",
  audio: "Audio",
  document: "Documento",
}

/** Fila de la vista conversaciones_resumen (conversación + cliente + último mensaje). */
export type ConversacionResumen = {
  id: string
  cliente_id: string
  estado: ConversacionEstado
  created_at: string
  cliente_nombre: string | null
  cliente_telefono: string
  ultimo_contenido: string | null
  ultimo_rol: RolMensaje | null
  ultimo_mensaje_at: string
  actividad_at: string
}

export type Etiqueta = {
  id: string
  nombre: string
  color: EtiquetaColor
  created_at: string
}

export type ClienteEtiqueta = {
  cliente_id: string
  etiqueta_id: string
}

export const ETIQUETA_COLORS = ["slate", "rose", "amber", "emerald", "sky", "violet"] as const
export type EtiquetaColor = (typeof ETIQUETA_COLORS)[number]

export const ETIQUETA_CLASSES: Record<EtiquetaColor, string> = {
  slate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  rose: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-200",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200",
  sky: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-200",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-200",
}

export type CitaEstado =
  | "pendiente_pago"
  | "confirmada"
  | "cancelada"
  | "completada"
  | "no_asistio"
  | "expirada"

// "pendiente_pago" = el horario está apartado pero la cita NO está agendada:
// se está esperando la captura del adelanto. "expirada" = ese plazo venció y
// el bot liberó el horario solo (distinto de "cancelada", que es alguien
// echándose atrás a propósito).
export const CITA_ESTADO_LABEL: Record<CitaEstado, string> = {
  pendiente_pago: "Esperando adelanto",
  confirmada: "Confirmada",
  cancelada: "Cancelada",
  completada: "Completada",
  no_asistio: "No asistió",
  expirada: "Liberada sin adelanto",
}

export type ComprobanteEstado = "sin_comprobante" | "confirmado" | "en_revision"

export const COMPROBANTE_ESTADO_LABEL: Record<ComprobanteEstado, string> = {
  sin_comprobante: "Sin comprobante",
  confirmado: "Pago confirmado",
  en_revision: "Comprobante en revisión",
}

// Mismos 3 nombres que usan el bot (config/business.ts) y la web
// (booking.js) — no hay tabla `barberos` todavía, así que tocar los tres
// lados si se agrega o quita uno.
export const BARBEROS = ["Cieza", "Nilton", "Bryan"] as const
export type Barbero = (typeof BARBEROS)[number]

export type Cita = {
  id: string
  cliente_id: string
  servicio_id: string
  inicio_utc: string
  fin_utc: string
  estado: CitaEstado
  creada_por: "bot" | "humano"
  notas: string | null
  barbero: Barbero | null
  comprobante_estado: ComprobanteEstado
  comprobante_path: string | null
  comprobante_monto_detectado: number | null
  comprobante_nota: string | null
  comprobante_origen: "whatsapp" | "web" | null
  deposito_esperado: number | null
  deposito_solicitado_at: string | null
  deposito_aviso_at: string | null
  deposito_expirado_at: string | null
  reserva_id: string
  /** Lo que el barbero anota DESPUÉS de atender: el corte real, el tono, la máquina. */
  atencion_notas: string | null
}

/** Ficha del cliente: lo que el barbero repasa antes de atenderlo. */
export type FichaCliente = {
  id: string
  nombre: string | null
  telefono: string
  email: string | null
  notas: string | null
  preferencias: string | null
  alergias: string | null
  created_at: string
}

export type NotificacionEstado = "pendiente" | "enviada" | "fallida" | "cancelada"

export type Notificacion = {
  id: string
  cliente_id: string
  cita_id: string | null
  tipo: "recordatorio_cita" | "promocion"
  plantilla: string
  estado: NotificacionEstado
  programada_para: string
  enviada_at: string | null
  error: string | null
  created_at: string
}

export type Course = {
  id: string
  icon: string
  title: string
  meta: string
  description: string
  images: string[]
  price: number | null
  sort_order: number
  active: boolean
  created_at: string
  updated_at: string
}

export type CourseDay = {
  id: string
  course_id: string
  title: string
  sort_order: number
}

export type LessonModality = "Video" | "Presencial"

export type CourseLesson = {
  id: string
  day_id: string
  title: string
  modality: LessonModality
  duration: string
  video_url: string | null
  sort_order: number
}

export type CourseMaterial = {
  id: string
  course_id: string
  name: string
  meta: string
  file_url: string
  sort_order: number
}

export type EnrollmentStatus = "pending" | "active" | "cancelled" | "completed"

export const ENROLLMENT_STATUS_LABEL: Record<EnrollmentStatus, string> = {
  pending: "Pendiente",
  active: "Activa",
  cancelled: "Cancelada",
  completed: "Completada",
}

export type Enrollment = {
  id: string
  student_id: string
  course_id: string
  status: EnrollmentStatus
  requested_at: string
  decided_at: string | null
}
