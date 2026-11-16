/** Tipos y utilidades del simulador de cortes (panel y app del celular). */

export const FORMAS_ROSTRO = [
  { id: "ovalado", label: "Ovalado" },
  { id: "redondo", label: "Redondo" },
  { id: "cuadrado", label: "Cuadrado" },
  { id: "alargado", label: "Alargado" },
  { id: "corazon", label: "Corazón" },
  { id: "diamante", label: "Diamante" },
  { id: "triangular", label: "Triangular" },
] as const

export const TIPOS_CABELLO = [
  { id: "lacio", label: "Lacio" },
  { id: "ondulado", label: "Ondulado" },
  { id: "rizado", label: "Rizado" },
  { id: "afro", label: "Afro" },
] as const

export type FormaRostro = (typeof FORMAS_ROSTRO)[number]["id"]

export const etiquetaForma = (id: string) => FORMAS_ROSTRO.find((f) => f.id === id)?.label ?? id
export const etiquetaCabello = (id: string) => TIPOS_CABELLO.find((t) => t.id === id)?.label ?? id

/** Para el barbero: qué buscar en cada forma (se muestra junto al resultado). */
export const CLAVE_FORMA: Record<string, string> = {
  ovalado: "Equilibrado: le quedan casi todos los cortes.",
  redondo: "Buscar altura arriba y lados bajos para alargar.",
  cuadrado: "Suavizar ángulos o marcarlos a propósito; texturas arriba.",
  alargado: "Evitar mucha altura; algo de volumen a los lados.",
  corazon: "Equilibrar frente ancha con un poco de largo abajo.",
  diamante: "Suavizar pómulos con volumen en frente y nuca.",
  triangular: "Volumen arriba para compensar una mandíbula ancha.",
}

export type AnalisisRostro = {
  formaRostro: string
  seguridad: "alta" | "media" | "baja"
  rasgos: { frente: string; pomulos: string; mandibula: string; menton: string; craneo: string; entradas: string }
  tipoCabello: string | null
  densidad: "baja" | "media" | "alta" | null
  resumen: string
  evitar: string[]
}

export type RecomendacionVista = {
  corte_id: string | null
  nombre: string
  motivo: string
  referencia_url: string | null
}

export type SimulacionVista = {
  id: string
  foto_url: string | null
  analisis: AnalisisRostro
  recomendaciones: RecomendacionVista[]
  resultados: { corte_id: string; url: string | null }[]
  expira_at: string
}

export type CorteReferencia = {
  id: string
  nombre: string
  descripcion: string | null
  formas_rostro: string[]
  tipos_cabello: string[]
  storage_path: string
  activo: boolean
  orden: number
  created_at: string
}

/**
 * Achica la foto en el navegador antes de mandarla: una foto del celular pesa 3–8 MB y para leer un rostro sobra con
 * 1280 px. Además la deja en JPEG (los iPhone sacan HEIC, que la API no acepta) y respeta la orientación EXIF.
 */
export async function prepararFoto(archivo: File, lado = 1280): Promise<{ base64: string; dataUrl: string }> {
  const bitmap = await createImageBitmap(archivo, { imageOrientation: "from-image" })
  const escala = Math.min(1, lado / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * escala)
  const h = Math.round(bitmap.height * escala)
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Sin canvas")
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  const dataUrl = canvas.toDataURL("image/jpeg", 0.88)
  return { base64: dataUrl.slice(dataUrl.indexOf(",") + 1), dataUrl }
}
