import { useCallback, useEffect, useRef, useState, type FormEvent } from "react"
import { toast } from "sonner"
import { Check, Loader2, Mic, RotateCcw, Send, Sparkles, Square, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  BotApiError,
  conversarAsistente,
  ejecutarAccionAsistente,
  type AccionAsistente,
  type TurnoAsistente,
} from "@/lib/botApi"

/* ---------------------------------------------------------------------------------------------------------------- */
/* Dictado: la API de Claude no recibe audio, así que la voz la pasa a texto el navegador (Chrome, Safari, Android).    */
/* ---------------------------------------------------------------------------------------------------------------- */

type ResultadoVoz = { isFinal: boolean; 0: { transcript: string } }
type EventoVoz = { resultIndex: number; results: ArrayLike<ResultadoVoz> }
type Reconocedor = {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((e: EventoVoz) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
}

function crearReconocedor(): Reconocedor | null {
  const w = window as unknown as { SpeechRecognition?: new () => Reconocedor; webkitSpeechRecognition?: new () => Reconocedor }
  const Clase = w.SpeechRecognition ?? w.webkitSpeechRecognition
  return Clase ? new Clase() : null
}

const ERRORES_VOZ: Record<string, string> = {
  "not-allowed": "Dale permiso al micrófono en el navegador para poder dictar.",
  "service-not-allowed": "Este navegador no deja usar el dictado. Escribe el pedido.",
  "no-speech": "No te escuché. Toca el micrófono y habla de nuevo.",
  network: "El dictado necesita internet.",
}

const SUGERENCIAS = [
  "Registra un corte básico de Nilton, pagó con Yape",
  "Vendí una cera MUK en efectivo",
  "¿Qué citas hay mañana?",
  "¿Cuánto vendimos hoy?",
  "Bloquea hoy de 3 a 4 de la tarde por almuerzo",
]

type Mensaje =
  | { tipo: "user" | "assistant"; texto: string }
  | { tipo: "accion"; texto: string; accion: AccionAsistente; estado: "pendiente" | "hecha" | "cancelada" | "ejecutando" }

/** El botón «✦ Asistente IA» y su ventana. `movil` lo sube por encima de la barra de pestañas de la app. */
export function AsistenteIA({ movil = false }: { movil?: boolean }) {
  const [abierto, setAbierto] = useState(false)
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [historial, setHistorial] = useState<TurnoAsistente[]>([])
  const [texto, setTexto] = useState("")
  const [pensando, setPensando] = useState(false)
  const [escuchando, setEscuchando] = useState(false)
  const [parcial, setParcial] = useState("")
  const [vozDisponible, setVozDisponible] = useState(true)
  const reconocedor = useRef<Reconocedor | null>(null)
  const finalRef = useRef("")
  const fondo = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setVozDisponible(crearReconocedor() !== null)
  }, [])

  useEffect(() => {
    fondo.current?.scrollTo({ top: fondo.current.scrollHeight, behavior: "smooth" })
  }, [mensajes, pensando, parcial])

  const enviar = useCallback(
    async (contenido: string) => {
      const limpio = contenido.trim()
      if (!limpio || pensando) return
      const nuevoHistorial: TurnoAsistente[] = [...historial, { rol: "user" as const, texto: limpio }].slice(-20)
      // La conversación para Claude tiene que empezar con un mensaje de la persona.
      while (nuevoHistorial[0]?.rol === "assistant") nuevoHistorial.shift()
      setHistorial(nuevoHistorial)
      setMensajes((m) => [...m, { tipo: "user", texto: limpio }])
      setTexto("")
      setPensando(true)
      try {
        const r = await conversarAsistente(nuevoHistorial)
        setHistorial((h) => [
          ...h,
          { rol: "assistant" as const, texto: r.tipo === "confirmar" ? `${r.texto} [Propuesta: ${r.accion.resumen}]` : r.texto },
        ])
        setMensajes((m) => [
          ...m,
          r.tipo === "confirmar"
            ? { tipo: "accion", texto: r.texto, accion: r.accion, estado: "pendiente" }
            : { tipo: "assistant", texto: r.texto },
        ])
      } catch (err) {
        setMensajes((m) => [
          ...m,
          { tipo: "assistant", texto: err instanceof BotApiError ? err.message : "No pude conectarme. Intenta otra vez." },
        ])
      } finally {
        setPensando(false)
      }
    },
    [historial, pensando],
  )

  async function confirmar(indice: number, accion: AccionAsistente) {
    setMensajes((m) => m.map((x, i) => (i === indice && x.tipo === "accion" ? { ...x, estado: "ejecutando" } : x)))
    try {
      const r = await ejecutarAccionAsistente(accion)
      setMensajes((m) => [
        ...m.map((x, i) => (i === indice && x.tipo === "accion" ? { ...x, estado: "hecha" as const } : x)),
        { tipo: "assistant", texto: r.texto },
      ])
      setHistorial((h): TurnoAsistente[] => [...h, { rol: "user", texto: "Confirmo." }, { rol: "assistant", texto: r.texto }])
      toast.success("Hecho.")
    } catch (err) {
      const motivo = err instanceof BotApiError ? err.message : "No se pudo completar."
      setMensajes((m) => [
        ...m.map((x, i) => (i === indice && x.tipo === "accion" ? { ...x, estado: "pendiente" as const } : x)),
        { tipo: "assistant", texto: `No se pudo: ${motivo}` },
      ])
      setHistorial((h): TurnoAsistente[] => [...h, { rol: "user", texto: "Confirmo." }, { rol: "assistant", texto: `No se pudo: ${motivo}` }])
    }
  }

  function cancelar(indice: number) {
    setMensajes((m) => m.map((x, i) => (i === indice && x.tipo === "accion" ? { ...x, estado: "cancelada" } : x)))
    setHistorial((h): TurnoAsistente[] => [...h, { rol: "user", texto: "Cancela eso, no lo registres." }, { rol: "assistant", texto: "Cancelado." }])
  }

  function escuchar() {
    if (escuchando) {
      reconocedor.current?.stop()
      return
    }
    const r = crearReconocedor()
    if (!r) {
      setVozDisponible(false)
      return
    }
    r.lang = "es-PE"
    r.interimResults = true
    r.continuous = false
    finalRef.current = ""
    r.onresult = (e) => {
      let interino = ""
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]!
        if (res.isFinal) finalRef.current += res[0].transcript
        else interino += res[0].transcript
      }
      setParcial((finalRef.current + " " + interino).trim())
    }
    r.onerror = (e) => {
      if (e.error !== "aborted") toast.error(ERRORES_VOZ[e.error] ?? "No se pudo usar el micrófono.")
    }
    r.onend = () => {
      setEscuchando(false)
      setParcial("")
      const dicho = finalRef.current.trim()
      // Lo dictado se manda solo: es para usarlo con las manos ocupadas.
      if (dicho) void enviar(dicho)
    }
    reconocedor.current = r
    setEscuchando(true)
    try {
      r.start()
    } catch {
      setEscuchando(false)
    }
  }

  function reiniciar() {
    reconocedor.current?.stop()
    setMensajes([])
    setHistorial([])
    setTexto("")
  }

  function alEnviar(e: FormEvent) {
    e.preventDefault()
    void enviar(texto)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className={cn(
          "fixed right-4 z-40 flex items-center gap-2 rounded-full bg-[#ECEBFF] px-4 py-2.5 text-[13px] font-bold uppercase tracking-wide text-[#4F46E5] shadow-lg shadow-indigo-500/10 transition hover:bg-[#E2E0FF] dark:bg-indigo-950 dark:text-indigo-200",
          movil ? "bottom-[calc(76px+env(safe-area-inset-bottom))]" : "bottom-5",
          abierto && "hidden",
        )}
        aria-label="Abrir Asistente IA"
      >
        <Sparkles className="size-[18px]" strokeWidth={2.2} />
        Asistente IA
      </button>

      {abierto && (
        <div
          className={cn(
            "fixed z-50 flex flex-col border border-border bg-background shadow-2xl",
            movil ? "inset-0 pt-[env(safe-area-inset-top)]" : "bottom-5 right-4 h-[min(640px,calc(100svh-40px))] w-[min(420px,calc(100vw-32px))]",
          )}
          role="dialog"
          aria-label="Asistente IA"
        >
          <header className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2 font-bold text-[#4F46E5] dark:text-indigo-300">
              <Sparkles className="size-5" /> Asistente IA
            </div>
            <div className="flex items-center gap-1">
              {mensajes.length > 0 && (
                <Button variant="ghost" size="icon" onClick={reiniciar} aria-label="Nueva conversación">
                  <RotateCcw className="size-4" />
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={() => setAbierto(false)} aria-label="Cerrar">
                <X className="size-4" />
              </Button>
            </div>
          </header>

          <div ref={fondo} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {mensajes.length === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Toca el micrófono y dime qué hacer: registrar un servicio o una venta, agendar o mover una cita, bloquear
                  un horario o consultar las ventas del día. Antes de guardar algo te pido que lo confirmes.
                </p>
                <div className="flex flex-wrap gap-2">
                  {SUGERENCIAS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => void enviar(s)}
                      className="rounded-full border border-border px-3 py-1.5 text-left text-xs hover:bg-muted"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mensajes.map((m, i) =>
              m.tipo === "accion" ? (
                <div key={i} className="space-y-2 border border-[#4F46E5]/30 bg-[#F5F4FF] p-3 dark:bg-indigo-950/40">
                  {m.texto && <p className="text-sm">{m.texto}</p>}
                  <p className="text-sm font-semibold">{m.accion.resumen}</p>
                  {m.estado === "pendiente" || m.estado === "ejecutando" ? (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => confirmar(i, m.accion)} disabled={m.estado === "ejecutando"}>
                        {m.estado === "ejecutando" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                        Confirmar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => cancelar(i)} disabled={m.estado === "ejecutando"}>
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">{m.estado === "hecha" ? "Hecho ✓" : "Cancelado"}</p>
                  )}
                </div>
              ) : (
                <div key={i} className={cn("flex", m.tipo === "user" ? "justify-end" : "justify-start")}>
                  <p
                    className={cn(
                      "max-w-[85%] whitespace-pre-wrap px-3 py-2 text-sm",
                      m.tipo === "user" ? "bg-foreground text-background" : "bg-muted",
                    )}
                  >
                    {m.texto}
                  </p>
                </div>
              ),
            )}

            {parcial && (
              <div className="flex justify-end">
                <p className="max-w-[85%] bg-foreground/60 px-3 py-2 text-sm italic text-background">{parcial}…</p>
              </div>
            )}
            {pensando && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> Pensando…
              </p>
            )}
          </div>

          <form onSubmit={alEnviar} className="flex items-center gap-2 border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {vozDisponible && (
              <button
                type="button"
                onClick={escuchar}
                disabled={pensando}
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-full transition",
                  escuchando ? "animate-pulse bg-rose-600 text-white" : "bg-[#4F46E5] text-white hover:bg-[#4338CA]",
                )}
                aria-label={escuchando ? "Dejar de escuchar" : "Hablar"}
              >
                {escuchando ? <Square className="size-4" /> : <Mic className="size-5" />}
              </button>
            )}
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder={escuchando ? "Escuchando…" : vozDisponible ? "Habla o escribe tu pedido" : "Escribe tu pedido"}
              className="h-11 min-w-0 flex-1 border border-border bg-background px-3 text-sm outline-none focus:border-foreground"
              disabled={escuchando}
            />
            <Button type="submit" size="icon" disabled={!texto.trim() || pensando} aria-label="Enviar">
              <Send className="size-4" />
            </Button>
          </form>
        </div>
      )}
    </>
  )
}
