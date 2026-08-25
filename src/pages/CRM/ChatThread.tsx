import { useEffect, useRef, useState, type FormEvent } from "react"
import { toast } from "sonner"
import { AlertTriangle, Bot, ChevronDown, Paperclip, Send, UserRound } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { enviarMensajeHumano, enviarPlantillaMensaje, BotApiError } from "@/lib/botApi"
import type { ConversacionResumen, Mensaje, PlantillaMedia } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { horasRestantesVentana, ventanaAbierta } from "./utils"

function horaCorta(iso: string) {
  return new Date(iso).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })
}

function MediaEnBurbuja({ mensaje }: { mensaje: Mensaje }) {
  if (!mensaje.media_url) return null
  if (mensaje.media_type === "image") {
    return <img src={mensaje.media_url} alt="" className="mb-1.5 max-h-64 rounded-md object-cover" />
  }
  if (mensaje.media_type === "video") {
    return <video src={mensaje.media_url} controls className="mb-1.5 max-h-64 rounded-md" />
  }
  if (mensaje.media_type === "audio") {
    return <audio src={mensaje.media_url} controls className="mb-1.5 w-full max-w-64" />
  }
  return (
    <a
      href={mensaje.media_url}
      target="_blank"
      rel="noreferrer"
      className="mb-1.5 block text-xs underline underline-offset-2"
    >
      Ver archivo
    </a>
  )
}

function Burbuja({ mensaje }: { mensaje: Mensaje }) {
  const esCliente = mensaje.rol === "user"
  const esHumano = mensaje.rol === "humano"

  return (
    <div className={cn("flex", esCliente ? "justify-start" : "justify-end")}>
      <div className={cn("max-w-[75%] rounded-lg px-3 py-2", esCliente ? "bg-muted" : "bg-primary text-primary-foreground")}>
        <MediaEnBurbuja mensaje={mensaje} />
        <p className="text-sm whitespace-pre-wrap break-words">{mensaje.contenido}</p>
        <div
          className={cn(
            "mt-1 flex items-center gap-1 text-[10px]",
            esCliente ? "text-muted-foreground" : "text-primary-foreground/70",
          )}
        >
          {!esCliente &&
            (esHumano ? (
              <>
                <UserRound className="size-2.5" /> Staff
              </>
            ) : (
              <>
                <Bot className="size-2.5" /> Bot
              </>
            ))}
          <span className={cn(!esCliente && "ml-auto")}>{horaCorta(mensaje.created_at)}</span>
        </div>
      </div>
    </div>
  )
}

export default function ChatThread({ conversacion }: { conversacion: ConversacionResumen | null }) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [loading, setLoading] = useState(false)
  const [texto, setTexto] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [cambiandoModo, setCambiandoModo] = useState(false)
  const [plantillas, setPlantillas] = useState<PlantillaMedia[]>([])
  const finRef = useRef<HTMLDivElement>(null)

  const conversacionId = conversacion?.id ?? null
  const modoHumano = conversacion?.estado === "escalada"
  const abierta = conversacion ? ventanaAbierta(conversacion) : false

  useEffect(() => {
    if (!conversacionId) {
      setMensajes([])
      return
    }
    let activo = true
    setLoading(true)

    async function cargar() {
      const { data, error } = await supabase
        .from("mensajes")
        .select("*")
        .eq("conversacion_id", conversacionId)
        .order("created_at", { ascending: true })
      if (!activo) return
      if (error) toast.error("No se pudo cargar la conversación.")
      else setMensajes(data as Mensaje[])
      setLoading(false)
    }
    cargar()

    const canal = supabase
      .channel(`crm-hilo-${conversacionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mensajes", filter: `conversacion_id=eq.${conversacionId}` },
        (payload) => setMensajes((previos) => [...previos, payload.new as Mensaje]),
      )
      .subscribe()

    return () => {
      activo = false
      supabase.removeChannel(canal)
    }
  }, [conversacionId])

  // Se carga una sola vez (no realtime): la biblioteca cambia poco y no
  // amerita una suscripción aparte solo para el selector de envío rápido.
  useEffect(() => {
    supabase
      .from("plantillas_media")
      .select("*")
      .eq("activo", true)
      .order("nombre")
      .then(({ data }) => setPlantillas((data as PlantillaMedia[]) ?? []))
  }, [])

  useEffect(() => {
    finRef.current?.scrollIntoView({ block: "end" })
  }, [mensajes])

  async function alternarModo(humano: boolean) {
    if (!conversacion) return
    setCambiandoModo(true)
    const { error } = await supabase
      .from("conversaciones")
      .update({ estado: humano ? "escalada" : "activa" })
      .eq("id", conversacion.id)
    setCambiandoModo(false)

    if (error) {
      toast.error("No se pudo cambiar el modo de la conversación.")
      return
    }
    toast.success(humano ? "El bot dejó de responder en este chat." : "El bot vuelve a responder en este chat.")
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (!conversacion || !texto.trim()) return

    setEnviando(true)
    try {
      await enviarMensajeHumano(conversacion.id, texto.trim())
      // El INSERT llega por realtime; limpiar acá evita duplicar la burbuja.
      setTexto("")
    } catch (err) {
      toast.error(err instanceof BotApiError ? err.message : "No se pudo enviar el mensaje.")
    } finally {
      setEnviando(false)
    }
  }

  async function enviarPlantilla(plantillaId: string) {
    if (!conversacion) return
    setEnviando(true)
    try {
      await enviarPlantillaMensaje(conversacion.id, plantillaId)
    } catch (err) {
      toast.error(err instanceof BotApiError ? err.message : "No se pudo enviar la multimedia.")
    } finally {
      setEnviando(false)
    }
  }

  if (!conversacion) {
    return (
      <section className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">Elige una conversación para verla aquí.</p>
      </section>
    )
  }

  return (
    <section className="flex min-w-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-5 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">
            {conversacion.cliente_nombre?.trim() || conversacion.cliente_telefono}
          </h2>
          <p className="text-xs text-muted-foreground">{conversacion.cliente_telefono}</p>
        </div>

        <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs">
          <span className={cn("font-medium", !modoHumano && "text-muted-foreground")}>Responde el bot</span>
          <Switch checked={modoHumano} onCheckedChange={alternarModo} disabled={cambiandoModo} />
          <span className={cn("font-medium", !modoHumano && "text-muted-foreground")}>Respondo yo</span>
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {loading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-12 w-2/3" />
            <Skeleton className="ml-auto h-12 w-1/2" />
            <Skeleton className="h-12 w-3/5" />
          </div>
        ) : mensajes.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Todavía no hay mensajes.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {mensajes.map((m) => (
              <Burbuja key={m.id} mensaje={m} />
            ))}
            <div ref={finRef} />
          </div>
        )}
      </div>

      <form onSubmit={enviar} className="shrink-0 border-t border-border px-5 py-3">
        {!modoHumano && (
          <p className="mb-2 text-xs text-muted-foreground">
            El bot está atendiendo este chat. Puedes escribir igual, pero activa <strong>Respondo yo</strong> para que
            deje de responder por su cuenta.
          </p>
        )}

        {!abierta && (
          <div className="mb-2 flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Pasaron más de 24 horas desde el último mensaje de la clienta. WhatsApp no permite escribirle texto libre;
              solo se puede retomar con una plantilla aprobada.
            </span>
          </div>
        )}

        <div className="flex items-end gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={!abierta || enviando || plantillas.length === 0}
              className="inline-flex h-9 shrink-0 items-center gap-1 rounded-md border border-border px-2.5 text-xs font-medium text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Adjuntar multimedia"
              title={plantillas.length === 0 ? "No hay multimedia en la biblioteca" : "Adjuntar multimedia"}
            >
              <Paperclip className="size-4" />
              <ChevronDown className="size-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {plantillas.map((p) => (
                <DropdownMenuItem key={p.id} onClick={() => enviarPlantilla(p.id)}>
                  {p.nombre}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                void enviar(e)
              }
            }}
            placeholder={abierta ? "Escribe tu respuesta…" : "Ventana de 24 horas cerrada"}
            disabled={!abierta || enviando}
            rows={2}
            className="min-h-0 resize-none"
          />
          <Button type="submit" disabled={!abierta || enviando || !texto.trim()} className="gap-1.5">
            <Send className="size-4" />
            Enviar
          </Button>
        </div>

        {abierta && (
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Quedan ~{horasRestantesVentana(conversacion)} h de ventana para escribir libremente.
          </p>
        )}
      </form>
    </section>
  )
}
