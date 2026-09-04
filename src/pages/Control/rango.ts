/**
 * Rangos de fechas del Control, siempre en días de Lima. Perú no tiene
 * horario de verano, así que la medianoche de Lima es un offset fijo -05:00 —
 * los límites se construyen como instantes UTC exactos (T05:00Z) para que la
 * consulta a la BD y el corte del Excel del negocio coincidan día a día.
 */

export type RangoClave = "quincena" | "mes" | "mes_anterior" | "30dias"

export const RANGOS: { clave: RangoClave; etiqueta: string }[] = [
  { clave: "quincena", etiqueta: "Esta quincena" },
  { clave: "mes", etiqueta: "Este mes" },
  { clave: "mes_anterior", etiqueta: "Mes anterior" },
  { clave: "30dias", etiqueta: "Últimos 30 días" },
]

/** "2026-09-01" del instante actual, en el calendario de Lima. */
export function hoyLima(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Lima" })
}

function partes(fechaISO: string): { anio: number; mes: number; dia: number } {
  const [anio, mes, dia] = fechaISO.split("-").map(Number)
  return { anio: anio!, mes: mes!, dia: dia! }
}

function fechaISO(anio: number, mes: number, dia: number): string {
  return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`
}

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"]

function ultimoDiaDelMes(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate()
}

export type Rango = { desde: string; hasta: string } // fechas Lima inclusive

/**
 * El mes de caja del negocio: abre el 16 y cierra el 15 del mes siguiente.
 * Todo el Control se organiza por estos ciclos, no por el mes calendario —
 * si no, la quincena del 16 al 30 quedaría partida entre dos cierres.
 *
 * `clave` es el día en que abre ("2026-08-16"), que lo identifica sin
 * ambigüedad; la etiqueta muestra los dos extremos ("16 ago – 15 set")
 * justamente para que nadie tenga que adivinar a qué mes "pertenece".
 */
export type Ciclo = Rango & { clave: string; etiqueta: string; etiquetaCorta: string }

function armarCiclo(anio: number, mes: number): Ciclo {
  const mesCierre = mes === 12 ? 1 : mes + 1
  const anioCierre = mes === 12 ? anio + 1 : anio
  const desde = fechaISO(anio, mes, 16)
  const hasta = fechaISO(anioCierre, mesCierre, 15)
  const abre = MESES_CORTOS[mes - 1]
  const cierra = MESES_CORTOS[mesCierre - 1]
  return {
    desde,
    hasta,
    clave: desde,
    etiqueta: `16 ${abre} – 15 ${cierra}${anioCierre !== new Date().getUTCFullYear() ? ` ${anioCierre}` : ""}`,
    etiquetaCorta: `${abre}–${cierra}`,
  }
}

/** El ciclo al que pertenece una fecha Lima. Del 1 al 15 todavía es el ciclo anterior. */
export function cicloDe(fecha: string): Ciclo {
  const { anio, mes, dia } = partes(fecha)
  if (dia >= 16) return armarCiclo(anio, mes)
  return mes === 1 ? armarCiclo(anio - 1, 12) : armarCiclo(anio, mes - 1)
}

/** El ciclo abierto hoy. */
export function cicloActual(): Ciclo {
  return cicloDe(hoyLima())
}

/** Mueve `pasos` ciclos hacia atrás (negativo) o adelante (positivo). */
export function cicloDesplazado(ciclo: Ciclo, pasos: number): Ciclo {
  const { anio, mes } = partes(ciclo.desde)
  const total = anio * 12 + (mes - 1) + pasos
  return armarCiclo(Math.floor(total / 12), (total % 12) + 1)
}

/** Los últimos `cantidad` ciclos, del más reciente al más viejo. */
export function ciclosRecientes(cantidad = 12): Ciclo[] {
  const actual = cicloActual()
  return Array.from({ length: cantidad }, (_, i) => cicloDesplazado(actual, -i))
}

export function calcularRango(clave: RangoClave): Rango {
  const hoy = hoyLima()
  const { anio, mes, dia } = partes(hoy)

  switch (clave) {
    case "quincena":
      // El negocio paga por quincenas: 1–15 y 16–fin de mes.
      return dia <= 15
        ? { desde: fechaISO(anio, mes, 1), hasta: fechaISO(anio, mes, 15) }
        : { desde: fechaISO(anio, mes, 16), hasta: fechaISO(anio, mes, ultimoDiaDelMes(anio, mes)) }
    case "mes":
      return { desde: fechaISO(anio, mes, 1), hasta: fechaISO(anio, mes, ultimoDiaDelMes(anio, mes)) }
    case "mes_anterior": {
      const mesPrev = mes === 1 ? 12 : mes - 1
      const anioPrev = mes === 1 ? anio - 1 : anio
      return { desde: fechaISO(anioPrev, mesPrev, 1), hasta: fechaISO(anioPrev, mesPrev, ultimoDiaDelMes(anioPrev, mesPrev)) }
    }
    case "30dias": {
      const d = new Date(`${hoy}T12:00:00Z`)
      d.setUTCDate(d.getUTCDate() - 29)
      return { desde: d.toISOString().slice(0, 10), hasta: hoy }
    }
  }
}

/** Instante UTC de la medianoche de Lima de esa fecha (inicio del día). */
export function inicioDiaLimaUTC(fecha: string): string {
  return `${fecha}T05:00:00.000Z`
}

/** Instante UTC del fin del día de Lima (exclusive: medianoche del siguiente). */
export function finDiaLimaUTC(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return `${d.toISOString().slice(0, 10)}T05:00:00.000Z`
}

/** El día Lima ("2026-09-01") al que pertenece un timestamp UTC. */
export function diaLimaDe(isoUTC: string): string {
  return new Date(isoUTC).toLocaleDateString("en-CA", { timeZone: "America/Lima" })
}

/** Lista inclusiva de días entre desde y hasta (fechas Lima). */
export function listarDias(rango: Rango): string[] {
  const dias: string[] = []
  const cursor = new Date(`${rango.desde}T12:00:00Z`)
  const fin = new Date(`${rango.hasta}T12:00:00Z`)
  while (cursor <= fin) {
    dias.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return dias
}

/** "1-Set" — el formato de fecha del Excel del negocio. */
export function etiquetaCorta(fecha: string): string {
  const { mes, dia } = partes(fecha)
  return `${dia}-${MESES_CORTOS[mes - 1]!.charAt(0).toUpperCase()}${MESES_CORTOS[mes - 1]!.slice(1)}`
}

/** "lun 1 set" para tooltips y tabla. */
export function etiquetaLarga(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00Z`)
  const semana = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"][d.getUTCDay()]
  const { mes, dia } = partes(fecha)
  return `${semana} ${dia} ${MESES_CORTOS[mes - 1]}`
}

export function formatoSoles(v: number): string {
  const redondeado = Math.round(v * 100) / 100
  return `S/ ${Number.isInteger(redondeado) ? redondeado : redondeado.toFixed(2)}`
}
