/**
 * Compresión de video en el propio navegador, para que un video salga bien por
 * WhatsApp (Estado o chat) y por redes sin que la plataforma lo destroce al
 * recomprimirlo. Todo pasa en el dispositivo: el video no se sube a ningún
 * servidor, así que no cuesta nada y funciona igual desde el celular.
 *
 * Usa WebCodecs (codificación por hardware) a través de mediabunny. Se importa
 * en dinámico: la librería pesa varios MB y solo hace falta al comprimir.
 *
 * A propósito NO usamos su `Conversion` de alto nivel: fija el perfil H.264
 * High, y Meta avisa que High con B-frames no se reproduce en los WhatsApp de
 * Android. Con la API de bajo nivel elegimos nosotros el perfil (Main o
 * Baseline), que es lo que Meta recomienda.
 */
import type { Input, InputAudioTrack, InputVideoTrack } from "mediabunny"

/** Tope de la Cloud API de WhatsApp para un video (documentación de Meta). */
export const LIMITE_WHATSAPP_BYTES = 16 * 1024 * 1024

export type PresetId = "estado" | "whatsapp" | "redes"

type PerfilAvc = "baseline" | "main"

// Nivel 4.0: cubre 1080p a 30 fps, que es el máximo que dejamos pasar.
const CODEC_AVC: Record<PerfilAvc, string> = {
  baseline: "avc1.420028",
  main: "avc1.4D0028",
}

const FPS_MAX = 30
const BITRATE_VIDEO_MIN = 300_000

export interface Preset {
  id: PresetId
  nombre: string
  detalle: string
  /** Lado menor del video en px (720 = "HD", 1080 = "Full HD"). Nunca se agranda. */
  ladoCorto: number
  /** Bitrate de video máximo, en bits/s. */
  videoBps: number
  audioBps: number
  /** Si se define, el video se corta en partes de como máximo estos segundos. */
  tramoSeg: number | null
  /** Si se define, el bitrate baja lo necesario para que cada archivo quepa. */
  maxBytes: number | null
  perfiles: PerfilAvc[]
  sufijo: string
}

/**
 * Los números de cada preset son el punto de partida, no una verdad: cuánto
 * recomprime cada red depende de la red y de la versión de la app. Para afinar
 * cualquiera, se cambia acá y se prueba subiendo el resultado desde un celular.
 */
export const PRESETS: Record<PresetId, Preset> = {
  estado: {
    id: "estado",
    nombre: "Estado de WhatsApp",
    detalle: "HD 720p, partes de hasta 30 s",
    ladoCorto: 720,
    videoBps: 3_500_000,
    audioBps: 128_000,
    tramoSeg: 30,
    maxBytes: LIMITE_WHATSAPP_BYTES,
    perfiles: ["main", "baseline"],
    sufijo: "estado",
  },
  whatsapp: {
    id: "whatsapp",
    nombre: "Enviar por WhatsApp",
    detalle: "Menos de 16 MB — el peso máximo que admite el bot",
    ladoCorto: 720,
    videoBps: 3_500_000,
    audioBps: 96_000,
    tramoSeg: null,
    maxBytes: LIMITE_WHATSAPP_BYTES,
    // Baseline primero: es el perfil que sí funciona en todos los Android.
    perfiles: ["baseline", "main"],
    sufijo: "whatsapp",
  },
  redes: {
    id: "redes",
    nombre: "Instagram y TikTok",
    detalle: "Full HD 1080p, calidad alta",
    ladoCorto: 1080,
    videoBps: 6_000_000,
    audioBps: 128_000,
    tramoSeg: null,
    maxBytes: null,
    perfiles: ["main", "baseline"],
    sufijo: "redes",
  },
}

/** Error con mensaje ya listo para mostrarle a quien usa el panel. */
export class ErrorVideo extends Error {}

export function esCancelacion(e: unknown): boolean {
  return e instanceof DOMException && e.name === "AbortError"
}

export function formatearTamano(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 100 * 1024 * 1024 ? 1 : 0)} MB`
}

export function formatearDuracion(seg: number): string {
  const total = Math.round(seg)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`
}

/** Motivo por el que este navegador no puede comprimir, o null si puede. */
export async function verificarSoporte(): Promise<string | null> {
  if (typeof VideoEncoder === "undefined" || typeof VideoDecoder === "undefined") {
    return "Este navegador no puede comprimir video. Usa Chrome, Edge o Safari 16.4 o más nuevo."
  }
  const { supported } = await VideoEncoder.isConfigSupported({
    codec: CODEC_AVC.main,
    width: 1280,
    height: 720,
    bitrate: 3_000_000,
  })
  return supported ? null : "Este dispositivo no puede codificar video H.264, que es lo que necesita WhatsApp."
}

/** Duración en segundos según el propio navegador, o null si no puede leerla. */
export function leerDuracion(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement("video")
    const cerrar = (valor: number | null) => {
      URL.revokeObjectURL(url)
      resolve(valor)
    }
    video.preload = "metadata"
    video.onloadedmetadata = () => cerrar(Number.isFinite(video.duration) ? video.duration : null)
    video.onerror = () => cerrar(null)
    video.src = url
  })
}

/** Cuántas partes saldrán de un video de esta duración con este preset. */
export function contarPartes(preset: Preset, duracionSeg: number): number {
  if (!preset.tramoSeg) return 1
  // El 0,001 evita que un video de exactamente 60,0000001 s salga en 3 partes.
  return Math.max(1, Math.ceil(duracionSeg / preset.tramoSeg - 0.001))
}

const par = (n: number) => Math.max(2, Math.round(n / 2) * 2)

async function elegirCodec(perfiles: PerfilAvc[], ancho: number, alto: number, bps: number, fps: number) {
  for (const perfil of perfiles) {
    const codec = CODEC_AVC[perfil]
    const { supported } = await VideoEncoder.isConfigSupported({
      codec,
      width: ancho,
      height: alto,
      bitrate: bps,
      framerate: fps,
    })
    if (supported) return codec
  }
  throw new ErrorVideo("Este dispositivo no puede codificar video H.264, que es lo que necesita WhatsApp.")
}

/** Bitrate de video con el que un tramo de `durSeg` cabe en `maxBytes`. */
function bitrateParaCaber(preset: Preset, durSeg: number): number {
  if (!preset.maxBytes) return preset.videoBps
  // 0,9: el contenedor pesa algo y un encoder nunca clava el bitrate pedido.
  const disponible = (preset.maxBytes * 0.9 * 8) / durSeg - preset.audioBps
  return Math.floor(Math.min(preset.videoBps, disponible))
}

interface Contexto {
  mb: typeof import("mediabunny")
  input: Input
  video: InputVideoTrack
  audio: InputAudioTrack | null
  /** "codificar" re-comprime el audio; "copiar" lo pasa tal cual (ya es AAC). */
  modoAudio: "codificar" | "copiar" | "ninguno"
  preset: Preset
  ancho: number
  alto: number
  fps: number
  signal: AbortSignal | undefined
}

async function codificarTramo(
  ctx: Contexto,
  t0: number,
  t1: number,
  durSeg: number,
  videoBps: number,
  alAvanzar: (fraccion: number) => void,
): Promise<ArrayBuffer> {
  const { mb, video, audio, preset, signal } = ctx
  const codec = await elegirCodec(preset.perfiles, ctx.ancho, ctx.alto, videoBps, ctx.fps)

  const target = new mb.BufferTarget()
  const output = new mb.Output({ format: new mb.Mp4OutputFormat({ fastStart: "in-memory" }), target })

  const fuenteVideo = new mb.VideoSampleSource({
    codec: "avc",
    bitrate: videoBps,
    keyFrameInterval: 2,
    // ancho/alto ya conservan la proporción del original, así que "fill" no deforma.
    transform: { width: ctx.ancho, height: ctx.alto, fit: "fill", ...(ctx.fps > FPS_MAX ? { frameRate: FPS_MAX } : {}) },
    onEncoderConfig: (config) => {
      config.codec = codec
    },
  })
  output.addVideoTrack(fuenteVideo, { frameRate: Math.min(ctx.fps, FPS_MAX) })

  let fuenteAudio: InstanceType<typeof mb.AudioSampleSource> | InstanceType<typeof mb.EncodedAudioPacketSource> | null = null
  if (audio && ctx.modoAudio === "codificar") {
    fuenteAudio = new mb.AudioSampleSource({ codec: "aac", bitrate: preset.audioBps })
  } else if (audio && ctx.modoAudio === "copiar") {
    fuenteAudio = new mb.EncodedAudioPacketSource("aac")
  }
  if (fuenteAudio) output.addAudioTrack(fuenteAudio)

  const revisarCancelacion = () => {
    if (signal?.aborted) throw new DOMException("Cancelado", "AbortError")
  }

  const pistaVideo = async () => {
    const sink = new mb.VideoSampleSink(video)
    for await (const muestra of sink.samples(t0, t1)) {
      try {
        revisarCancelacion()
        alAvanzar(Math.min(1, Math.max(0, (muestra.timestamp - t0) / durSeg)))
        muestra.setTimestamp(muestra.timestamp - t0)
        await fuenteVideo.add(muestra)
      } finally {
        muestra.close()
      }
    }
    fuenteVideo.close()
  }

  const pistaAudio = async () => {
    if (!audio || !fuenteAudio) return
    if (ctx.modoAudio === "codificar" && fuenteAudio instanceof mb.AudioSampleSource) {
      const sink = new mb.AudioSampleSink(audio)
      for await (const muestra of sink.samples(t0, t1)) {
        try {
          revisarCancelacion()
          muestra.setTimestamp(muestra.timestamp - t0)
          await fuenteAudio.add(muestra)
        } finally {
          muestra.close()
        }
      }
    } else if (fuenteAudio instanceof mb.EncodedAudioPacketSource) {
      const sink = new mb.EncodedPacketSink(audio)
      const decoderConfig = await audio.getDecoderConfig()
      const primero = await sink.getPacket(t0)
      let esPrimero = true
      if (primero) {
        for await (const paquete of sink.packets(primero)) {
          revisarCancelacion()
          if (paquete.timestamp >= t1) break
          // El primer paquete puede caer unos ms antes de t0: se ancla a 0.
          const copia = paquete.clone({ timestamp: Math.max(0, paquete.timestamp - t0) })
          await fuenteAudio.add(copia, esPrimero && decoderConfig ? { decoderConfig } : undefined)
          esPrimero = false
        }
      }
    }
    fuenteAudio.close()
  }

  try {
    await output.start()
    await Promise.all([pistaVideo(), pistaAudio()])
    await output.finalize()
  } catch (e) {
    await output.cancel().catch(() => {})
    throw e
  }
  if (!target.buffer) throw new ErrorVideo("No se pudo generar el archivo de video.")
  return target.buffer
}

export interface OpcionesOptimizar {
  /** Avance total de 0 a 1, sumando todas las partes. */
  onProgreso?: (fraccion: number) => void
  signal?: AbortSignal
  /** Solo aplica a presets con `tramoSeg`. Por defecto true. */
  dividir?: boolean
}

/**
 * Comprime `file` según `preset` y devuelve uno o varios MP4 (H.264 + AAC) con
 * el moov al inicio, listos para compartir. Lanza `ErrorVideo` con un mensaje
 * mostrable, o un AbortError si se cancela (ver `esCancelacion`).
 */
export async function optimizarVideo(file: File, preset: Preset, opciones: OpcionesOptimizar = {}): Promise<File[]> {
  const { onProgreso, signal, dividir = true } = opciones
  const mb = await import("mediabunny")
  const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS })

  try {
    const video = await input.getPrimaryVideoTrack()
    if (!video) throw new ErrorVideo("Ese archivo no tiene video.")
    if (!(await video.canDecode())) {
      throw new ErrorVideo(
        "Este navegador no puede leer ese video (suele pasar con HEVC/H.265). Prueba desde Chrome o Safari actualizado.",
      )
    }

    const audio = await input.getPrimaryAudioTrack()
    let modoAudio: Contexto["modoAudio"] = "ninguno"
    if (audio) {
      if ((await audio.canDecode()) && (await mb.canEncodeAudio("aac", { bitrate: preset.audioBps }))) {
        modoAudio = "codificar"
      } else if (audio.codec === "aac") {
        modoAudio = "copiar"
      }
    }

    const escala = Math.min(1, preset.ladoCorto / Math.min(video.displayWidth, video.displayHeight))
    const ancho = par(video.displayWidth * escala)
    const alto = par(video.displayHeight * escala)
    const { averagePacketRate } = await video.computePacketStats(200)
    const fps = averagePacketRate > 0 ? averagePacketRate : FPS_MAX

    const inicio = await input.getFirstTimestamp()
    const total = (await input.computeDuration()) - inicio
    if (!(total > 0)) throw new ErrorVideo("No se pudo leer la duración del video.")

    const partes = dividir ? contarPartes(preset, total) : 1
    const durParte = total / partes
    const ctx: Contexto = { mb, input, video, audio, modoAudio, preset, ancho, alto, fps, signal }

    const base = file.name.replace(/\.[^.]+$/, "") || "video"
    const salida: File[] = []
    let maximo = 0
    const reportar = (i: number, fraccion: number) => {
      maximo = Math.max(maximo, (i + fraccion) / partes)
      onProgreso?.(maximo)
    }

    for (let i = 0; i < partes; i++) {
      const t0 = inicio + i * durParte
      const t1 = i === partes - 1 ? Infinity : t0 + durParte
      let bps = bitrateParaCaber(preset, durParte)
      if (bps < BITRATE_VIDEO_MIN) {
        throw new ErrorVideo("Ese video es demasiado largo para caber en 16 MB con buena calidad. Recórtalo antes.")
      }

      let buffer = await codificarTramo(ctx, t0, t1, durParte, bps, (f) => reportar(i, f))
      // Los encoders por hardware a veces se pasan del bitrate: se reintenta
      // más bajo en vez de entregar un archivo que WhatsApp rechazaría.
      for (let intento = 0; preset.maxBytes && buffer.byteLength > preset.maxBytes && intento < 2; intento++) {
        bps = Math.floor(bps * ((preset.maxBytes * 0.85) / buffer.byteLength))
        if (bps < BITRATE_VIDEO_MIN) break
        buffer = await codificarTramo(ctx, t0, t1, durParte, bps, (f) => reportar(i, f))
      }
      if (preset.maxBytes && buffer.byteLength > preset.maxBytes) {
        throw new ErrorVideo("No se logró bajar el video de 16 MB. Recórtalo y vuelve a intentar.")
      }

      const parteTxt = partes > 1 ? `-parte${i + 1}` : ""
      salida.push(new File([buffer], `${base}-${preset.sufijo}${parteTxt}.mp4`, { type: "video/mp4" }))
      reportar(i, 1)
    }
    return salida
  } finally {
    input.dispose()
  }
}
