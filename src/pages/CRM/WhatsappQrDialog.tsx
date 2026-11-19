import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Loader2, QrCode, TriangleAlert, Unlink } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  BotApiError,
  conectarWhatsappQr,
  desvincularWhatsappQr,
  estadoWhatsappQr,
  type EstadoWhatsappQr,
} from "@/lib/botApi"
import { cn } from "@/lib/utils"

const ETIQUETA: Record<EstadoWhatsappQr["estado"], { texto: string; tono: string }> = {
  apagado: { texto: "Apagado en el servidor", tono: "bg-muted text-muted-foreground" },
  sin_sesion: { texto: "Sin número vinculado", tono: "bg-muted text-muted-foreground" },
  esperando_qr: { texto: "Esperando el escaneo", tono: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200" },
  conectando: { texto: "Conectando…", tono: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200" },
  conectado: { texto: "Conectado", tono: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" },
  desconectado: { texto: "Desconectado", tono: "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200" },
}

const formatoTelefono = (t: string) =>
  t.length === 11 && t.startsWith("51") ? `+51 ${t.slice(2, 5)} ${t.slice(5, 8)} ${t.slice(8)}` : `+${t}`

/**
 * Vincular un WhatsApp cualquiera escaneando un QR (como WhatsApp Web), además del número oficial del bot. Lo que los
 * clientes le escriban a ese número entra a Conversaciones (con la marca «QR») y la respuesta sale por el mismo número.
 */
export default function WhatsappQrDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [estado, setEstado] = useState<EstadoWhatsappQr | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [botResponde, setBotResponde] = useState<boolean | null>(null)
  const [migrada, setMigrada] = useState(true)

  const cargar = useCallback(async () => {
    try {
      setEstado(await estadoWhatsappQr())
      setError(null)
    } catch (err) {
      setError(err instanceof BotApiError ? err.message : "No se pudo consultar al bot.")
    }
  }, [])

  const cargarAjuste = useCallback(async () => {
    const { data, error: errorLectura } = await supabase.from("configuracion").select("*").single()
    if (errorLectura || !data) return
    if (!("qr_bot_responde" in data)) {
      setMigrada(false)
      return
    }
    setMigrada(true)
    setBotResponde((data as { qr_bot_responde: boolean }).qr_bot_responde)
  }, [])

  // Mientras espera el escaneo o se conecta, se pregunta seguido; en reposo, de vez en cuando. Solo con la ventana abierta.
  const rapido = estado?.estado === "esperando_qr" || estado?.estado === "conectando"
  useEffect(() => {
    if (!open) return
    const primera = setTimeout(() => {
      void cargar()
      void cargarAjuste()
    }, 0)
    const id = setInterval(() => void cargar(), rapido ? 2500 : 15_000)
    return () => {
      clearTimeout(primera)
      clearInterval(id)
    }
  }, [open, rapido, cargar, cargarAjuste])

  async function conectar() {
    setOcupado(true)
    try {
      setEstado(await conectarWhatsappQr())
    } catch (err) {
      toast.error(err instanceof BotApiError ? err.message : "No se pudo generar el QR.")
    } finally {
      setOcupado(false)
    }
  }

  async function desvincular() {
    if (!window.confirm("¿Desvincular este número? Dejarán de entrar sus mensajes al panel y habrá que escanear otro QR.")) return
    setOcupado(true)
    try {
      setEstado(await desvincularWhatsappQr())
      toast.success("Número desvinculado.")
    } catch (err) {
      toast.error(err instanceof BotApiError ? err.message : "No se pudo desvincular.")
    } finally {
      setOcupado(false)
    }
  }

  async function cambiarBot(valor: boolean) {
    setBotResponde(valor)
    const { error: errorGuardar } = await supabase.from("configuracion").update({ qr_bot_responde: valor }).eq("id", true)
    if (errorGuardar) {
      setBotResponde(!valor)
      toast.error("No se pudo guardar.")
      return
    }
    toast.success(valor ? "El bot contestará en el número vinculado." : "En el número vinculado contesta una persona.")
  }

  const e = estado?.estado
  const etiqueta = e ? ETIQUETA[e] : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="size-5" /> WhatsApp por QR
            <span className="border border-border px-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              no oficial
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 text-sm">
          <p className="text-muted-foreground">
            Vincula cualquier número de WhatsApp escaneando su QR, como en WhatsApp Web. Lo que le escriban sus clientes entra
            aquí con la marca «QR», y lo que respondas sale por ese mismo número. El número oficial del bot sigue igual.
          </p>

          <div className="flex gap-2 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <p>
              <strong>No está autorizado por Meta:</strong> WhatsApp puede bloquear el número, sobre todo con envíos masivos o a
              gente que no escribió primero. Por eso solo se contesta a quien escribe, no salen plantillas ni promociones por
              aquí (los recordatorios siguen saliendo por el número oficial) y hay un tope de mensajes por minuto.
            </p>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex flex-wrap items-center justify-between gap-2">
            {etiqueta ? (
              <span className={cn("px-2 py-1 text-xs font-medium", etiqueta.tono)}>{etiqueta.texto}</span>
            ) : (
              <span className="text-xs text-muted-foreground">Consultando…</span>
            )}
            {estado?.telefono && <span className="text-sm font-semibold">{formatoTelefono(estado.telefono)}</span>}
          </div>

          {estado?.error && <p className="text-xs text-muted-foreground">{estado.error}</p>}

          {e === "esperando_qr" && (
            <div className="grid justify-items-center gap-2">
              {estado?.qr ? (
                <img src={estado.qr} alt="Código QR para vincular WhatsApp" className="size-64 border border-border bg-white p-2" />
              ) : (
                <div className="flex size-64 items-center justify-center border border-border">
                  <Loader2 className="size-6 animate-spin" />
                </div>
              )}
              <p className="text-center text-xs text-muted-foreground">
                En el celular: WhatsApp → Ajustes → Dispositivos vinculados → Vincular un dispositivo → escanea este código.
              </p>
            </div>
          )}

          {e === "apagado" && (
            <p className="text-xs text-muted-foreground">
              Está apagado en el servidor (variable <code>WHATSAPP_QR_HABILITADO</code> del bot).
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {(e === "sin_sesion" || e === "desconectado") && (
              <Button onClick={conectar} disabled={ocupado}>
                {ocupado ? <Loader2 className="size-4 animate-spin" /> : <QrCode className="size-4" />}
                {e === "desconectado" ? "Reconectar / nuevo QR" : "Generar QR"}
              </Button>
            )}
            {(e === "conectado" || e === "conectando" || e === "esperando_qr" || e === "desconectado") && (
              <Button variant="outline" onClick={desvincular} disabled={ocupado}>
                <Unlink className="size-4" /> {e === "esperando_qr" ? "Cancelar" : "Desvincular número"}
              </Button>
            )}
          </div>

          <div className="border-t border-border pt-3">
            {migrada ? (
              <label className="flex items-start justify-between gap-3">
                <span>
                  <span className="block font-medium">Que el bot conteste en este número</span>
                  <span className="block text-xs text-muted-foreground">
                    Apagado: los chats de este número entran en «Respondo yo» y contesta una persona (cada chat se puede pasar al bot con su interruptor). Déjalo apagado si es un número personal.
                  </span>
                </span>
                <Switch checked={botResponde === true} disabled={botResponde === null} onCheckedChange={cambiarBot} />
              </label>
            ) : (
              <p className="text-xs text-amber-900 dark:text-amber-200">
                Falta correr la migración <code>0034_whatsapp_qr.sql</code> en Supabase.
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
