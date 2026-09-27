import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Loader2, TriangleAlert } from "lucide-react"
import {
  ErrorVideo,
  LIMITE_WHATSAPP_BYTES,
  PRESETS,
  esCancelacion,
  formatearTamano,
  optimizarVideo,
} from "@/lib/videoHd"
import { Button } from "@/components/ui/button"

/**
 * WhatsApp no deja mandar un video de más de 16 MB, y el bot lo descubriría
 * recién cuando una clienta lo pida. Esto avisa al subirlo a la biblioteca y
 * ofrece dejarlo listo ahí mismo, sin pasar por otra herramienta.
 */
export default function AvisoVideoPesado({
  archivo,
  onOptimizado,
}: {
  archivo: File | null
  onOptimizado: (file: File) => void
}) {
  const [progreso, setProgreso] = useState<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  if (!archivo || !archivo.type.startsWith("video/") || archivo.size <= LIMITE_WHATSAPP_BYTES) return null

  async function optimizar() {
    if (!archivo) return
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setProgreso(0)
    let ultimoPct = -1
    try {
      const [listo] = await optimizarVideo(archivo, PRESETS.whatsapp, {
        dividir: false,
        signal: ctrl.signal,
        onProgreso: (p) => {
          const pct = Math.floor(p * 100)
          if (pct === ultimoPct) return
          ultimoPct = pct
          setProgreso(p)
        },
      })
      if (listo) {
        onOptimizado(listo)
        toast.success(`Video optimizado: ${formatearTamano(archivo.size)} → ${formatearTamano(listo.size)}.`)
      }
    } catch (e) {
      if (!esCancelacion(e)) {
        toast.error(e instanceof ErrorVideo ? e.message : "No se pudo optimizar el video.")
      }
    } finally {
      abortRef.current = null
      setProgreso(null)
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-muted p-3 text-xs">
      <div className="flex items-start gap-2">
        <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
        <p>
          Este video pesa {formatearTamano(archivo.size)} y WhatsApp no admite más de 16 MB: el bot no podría enviarlo.
        </p>
      </div>
      {progreso === null ? (
        <Button type="button" size="sm" variant="outline" className="w-fit" onClick={optimizar}>
          Optimizar para WhatsApp
        </Button>
      ) : (
        <div className="flex items-center gap-2">
          <Loader2 className="size-3.5 animate-spin" />
          Optimizando… {Math.floor(progreso * 100)}%
          <Button type="button" size="sm" variant="ghost" onClick={() => abortRef.current?.abort()}>
            Cancelar
          </Button>
        </div>
      )}
    </div>
  )
}
