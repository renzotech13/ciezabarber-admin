/**
 * Rangos de fechas del Control, siempre en días de Lima. Perú no tiene
 * horario de verano, así que la medianoche de Lima es un offset fijo -05:00 —
 * los límites se construyen como instantes UTC exactos (T05:00Z) para que la
 * consulta a la BD y el corte del Excel del negocio coincidan día a día.
 */

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
const MESES_LARGOS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "setiembre", "octubre", "noviembre", "diciembre",
]

function ultimoDiaDelMes(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate()
}

/** Suma días a una fecha Lima sin pasar por husos horarios. */
function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

export type Rango = { desde: string; hasta: string } // fechas Lima inclusive

/**
 * Cómo se mira el periodo: por día, por semana (lunes a domingo), por mes
 * calendario o de quincena a quincena — el mes de caja del negocio, que va
 * del 16 al 15 del mes siguiente.
 */
export type TipoPeriodo = "dia" | "semana" | "mes" | "ciclo"

export const TIPOS_PERIODO: { clave: TipoPeriodo; etiqueta: string }[] = [
  { clave: "dia", etiqueta: "Día" },
  { clave: "semana", etiqueta: "Semana" },
  { clave: "mes", etiqueta: "Mes" },
  { clave: "ciclo", etiqueta: "16 al 15" },
]

export type Periodo = Rango & { tipo: TipoPeriodo; etiqueta: string }

/**
 * El mes de caja del negocio: abre el 16 y cierra el 15 del mes siguiente.
 * La caja se arquea siempre así, aunque el resto del Control se esté mirando
 * por día o por semana.
 *
 * `clave` es el día en que abre ("2026-08-16"), que lo identifica sin
 * ambigüedad; la etiqueta muestra los dos extremos ("16 ago – 15 set")
 * justamente para que nadie tenga que adivinar a qué mes "pertenece".
 */
export type Ciclo = Rango & { clave: string; etiqueta: string }

function armarCiclo(anio: number, mes: number): Ciclo {
  const mesCierre = mes === 12 ? 1 : mes + 1
  const anioCierre = mes === 12 ? anio + 1 : anio
  const desde = fechaISO(anio, mes, 16)
  const hasta = fechaISO(anioCierre, mesCierre, 15)
  const anioActual = Number(hoyLima().slice(0, 4))
  return {
    desde,
    hasta,
    clave: desde,
    etiqueta: `16 ${MESES_CORTOS[mes - 1]} – 15 ${MESES_CORTOS[mesCierre - 1]}${anioCierre !== anioActual ? ` ${anioCierre}` : ""}`,
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

const SEMANA_CORTA = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"]

/** El lunes de la semana de esa fecha (la semana laboral arranca el lunes). */
function lunesDe(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00Z`)
  // getUTCDay() es 0 el domingo: ahí el lunes está 6 días atrás, no 1 adelante.
  const desplazamiento = (d.getUTCDay() + 6) % 7
  return sumarDias(fecha, -desplazamiento)
}

/** El periodo del tipo pedido que contiene esa fecha Lima. */
export function periodoDe(tipo: TipoPeriodo, fecha: string): Periodo {
  const { anio, mes } = partes(fecha)
  switch (tipo) {
    case "dia":
      return { tipo, desde: fecha, hasta: fecha, etiqueta: etiquetaLarga(fecha) }
    case "semana": {
      const desde = lunesDe(fecha)
      const hasta = sumarDias(desde, 6)
      return { tipo, desde, hasta, etiqueta: `${etiquetaLarga(desde)} – ${etiquetaLarga(hasta)}` }
    }
    case "mes":
      return {
        tipo,
        desde: fechaISO(anio, mes, 1),
        hasta: fechaISO(anio, mes, ultimoDiaDelMes(anio, mes)),
        etiqueta: `${MESES_LARGOS[mes - 1]} ${anio}`,
      }
    case "ciclo": {
      const ciclo = cicloDe(fecha)
      return { tipo, desde: ciclo.desde, hasta: ciclo.hasta, etiqueta: ciclo.etiqueta }
    }
  }
}

/** El periodo en curso del tipo pedido. */
export function periodoActual(tipo: TipoPeriodo): Periodo {
  return periodoDe(tipo, hoyLima())
}

/**
 * Mueve el periodo `pasos` unidades hacia atrás (negativo) o adelante.
 *
 * Para día y semana alcanza con correr los días; para mes y ciclo hay que
 * contar en meses, porque no todos duran lo mismo.
 */
export function periodoDesplazado(periodo: Periodo, pasos: number): Periodo {
  switch (periodo.tipo) {
    case "dia":
      return periodoDe("dia", sumarDias(periodo.desde, pasos))
    case "semana":
      return periodoDe("semana", sumarDias(periodo.desde, pasos * 7))
    case "mes":
    case "ciclo": {
      const { anio, mes, dia } = partes(periodo.desde)
      const total = anio * 12 + (mes - 1) + pasos
      return periodoDe(periodo.tipo, fechaISO(Math.floor(total / 12), (total % 12) + 1, dia))
    }
  }
}

/** ¿Este periodo es el que corre ahora mismo? */
export function esPeriodoActual(periodo: Periodo): boolean {
  return periodo.desde === periodoActual(periodo.tipo).desde
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
  const { mes, dia } = partes(fecha)
  return `${SEMANA_CORTA[d.getUTCDay()]} ${dia} ${MESES_CORTOS[mes - 1]}`
}

export function formatoSoles(v: number): string {
  const redondeado = Math.round(v * 100) / 100
  return `S/ ${Number.isInteger(redondeado) ? redondeado : redondeado.toFixed(2)}`
}
