export type BusinessHourRow = {
  id: string
  weekday: number
  opens_at: string
  closes_at: string
}

export type Bloqueo = {
  id: string
  inicio_utc: string
  fin_utc: string
  motivo: string
  created_at: string
}

export const DIAS_SEMANA = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"] as const

export type Configuracion = {
  id: true
  recordatorio_horas_antes: number
  updated_at: string
}
