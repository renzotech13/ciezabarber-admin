import { useEffect, useRef, useState, type ChangeEvent } from "react"
import { toast } from "sonner"
import { Download, Loader2, Share2, Video, X } from "lucide-react"
import {
  ErrorVideo,
  PRESETS,
  contarPartes,
  esCancelacion,
  formatearDuracion,
  formatearTamano,
  leerDuracion,
  optimizarVideo,
  verificarSoporte,
  type PresetId,
} from "@/lib/videoHd"
import { Button, buttonVariants } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

interface Resultado {
  file: File
  url: string
}

/**
 * Comprimir un video ya cargado tarda segundos, pero en un celular la pantalla
 * se apaga sola y el navegador pausa la pestaña: el proceso quedaría a medias.
 * Si el navegador no soporta wake lock, se sigue sin él.
 */
async function mantenerPantallaEncendida(): Promise<() => void> {
  try {
    const lock = await navigator.wakeLock?.request("screen")
    return () => void lock?.release()
  } catch {
    return () => {}
  }
}

function puedeCompartir(files: File[]): boolean {
  return typeof navigator.canShare === "function" && navigator.canShare({ files })
}

async function compartir(files: File[]) {
  try {
    await navigator.share({ files })
  } catch (e) {
    // Cerrar el menú de compartir también lanza AbortError: no es un fallo.
    if (e instanceof DOMException && e.name === "AbortError") return
    toast.error("No se pudo abrir el menú de compartir. Descarga el video y envíalo desde la app.")
  }
}

/**
 * La herramienta completa: elegir un video, escoger el destino, comprimirlo y
 * compartirlo o descargarlo. La usan tanto el panel de escritorio como la app
 * del celular — en el celular es donde más sentido tiene, porque ahí está el
 * video y ahí se abre WhatsApp.
 */
export default function VideoOptimizer() {
  const [archivo, setArchivo] = useState<File | null>(null)
  const [medida, setMedida] = useState<{ file: File; seg: number | null } | null>(null)
  const [presetId, setPresetId] = useState<PresetId>("estado")
  const [dividir, setDividir] = useState(true)
  const [soporte, setSoporte] = useState<string | null | undefined>(undefined)
  const [trabajando, setTrabajando] = useState(false)
  const [progreso, setProgreso] = useState(0)
  const [resultados, setResultados] = useState<Resultado[]>([])
  const abortRef = useRef<AbortController | null>(null)
  const urlsRef = useRef<string[]>([])

  const preset = PRESETS[presetId]
  const duracion = medida && medida.file === archivo ? medida.seg : null
  const partes = duracion && dividir ? contarPartes(preset, duracion) : 1

  useEffect(() => {
    verificarSoporte().then(setSoporte, () => setSoporte("No se pudo comprobar si este navegador puede comprimir video."))
    return () => {
      abortRef.current?.abort()
      urlsRef.current.forEach((u) => URL.revokeObjectURL(u))
    }
  }, [])

  useEffect(() => {
    if (!archivo) return
    let vivo = true
    leerDuracion(archivo).then((seg) => vivo && setMedida({ file: archivo, seg }))
    return () => {
      vivo = false
    }
  }, [archivo])

  function soltarResultados() {
    urlsRef.current.forEach((u) => URL.revokeObjectURL(u))
    urlsRef.current = []
    setResultados([])
  }

  function elegir(e: ChangeEvent<HTMLInputElement>) {
    soltarResultados()
    setArchivo(e.target.files?.[0] ?? null)
  }

  async function optimizar() {
    if (!archivo) return
    soltarResultados()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setTrabajando(true)
    setProgreso(0)
    const liberarPantalla = await mantenerPantallaEncendida()

    // El motor avisa por cada cuadro (miles de veces); a la pantalla le basta 1%.
    let ultimoPct = -1
    try {
      const archivos = await optimizarVideo(archivo, preset, {
        dividir,
        signal: ctrl.signal,
        onProgreso: (p) => {
          const pct = Math.floor(p * 100)
          if (pct === ultimoPct) return
          ultimoPct = pct
          setProgreso(p)
        },
      })
      const nuevos = archivos.map((file) => ({ file, url: URL.createObjectURL(file) }))
      urlsRef.current = nuevos.map((r) => r.url)
      setResultados(nuevos)
    } catch (e) {
      if (!esCancelacion(e)) {
        toast.error(e instanceof ErrorVideo ? e.message : "No se pudo procesar ese video. Prueba con otro archivo.")
      }
    } finally {
      liberarPantalla()
      abortRef.current = null
      setTrabajando(false)
    }
  }

  const pesoOriginal = archivo?.size ?? 0
  const pesoFinal = resultados.reduce((suma, r) => suma + r.file.size, 0)
  const archivosListos = resultados.map((r) => r.file)

  return (
    <div className="grid grid-cols-1 gap-5">
      {soporte && (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {soporte}
        </p>
      )}

      <div className="grid gap-2 rounded-lg border border-border bg-card p-4">
        <Label htmlFor="vh-archivo" className="text-xs">
          Video
        </Label>
        <input
          id="vh-archivo"
          type="file"
          accept="video/*"
          disabled={trabajando}
          onChange={elegir}
          className="w-full text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-background file:px-3 file:py-2 file:text-xs file:font-medium"
        />
        {archivo && (
          <p className="text-xs text-muted-foreground">
            {formatearTamano(archivo.size)}
            {duracion ? ` · ${formatearDuracion(duracion)}` : ""}
          </p>
        )}
      </div>

      <div className="grid gap-2">
        <div className="text-xs font-medium">¿Para dónde es?</div>
        <div role="radiogroup" aria-label="Destino del video" className="grid gap-2">
          {Object.values(PRESETS).map((p) => {
            const activo = p.id === presetId
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={activo}
                disabled={trabajando}
                onClick={() => setPresetId(p.id)}
                className={cn(
                  "rounded-lg border p-3 text-left transition-colors disabled:opacity-60",
                  activo ? "border-foreground bg-muted" : "border-border bg-card hover:bg-muted/50",
                )}
              >
                <div className="text-sm font-medium">{p.nombre}</div>
                <div className="text-xs text-muted-foreground">{p.detalle}</div>
              </button>
            )
          })}
        </div>

        {preset.tramoSeg && (
          <label className="mt-1 flex items-center gap-2 text-xs">
            <Switch checked={dividir} onCheckedChange={setDividir} disabled={trabajando} />
            <span>
              Dividir en partes de {preset.tramoSeg} s
              {duracion && dividir ? (
                <span className="text-muted-foreground">
                  {partes > 1 ? ` — saldrán ${partes} partes` : " — cabe en una sola parte"}
                </span>
              ) : null}
            </span>
          </label>
        )}
      </div>

      {trabajando ? (
        <div className="grid gap-2 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              Optimizando… {Math.floor(progreso * 100)}%
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={() => abortRef.current?.abort()}>
              <X className="size-3.5" />
              Cancelar
            </Button>
          </div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.floor(progreso * 100)}
            className="h-2 overflow-hidden rounded-full bg-muted"
          >
            <div className="h-full bg-foreground transition-[width]" style={{ width: `${progreso * 100}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">Mantén esta pantalla abierta hasta que termine.</p>
        </div>
      ) : (
        <Button type="button" className="h-11 gap-2 text-sm" disabled={!archivo || !!soporte} onClick={optimizar}>
          <Video className="size-4" />
          Optimizar video
        </Button>
      )}

      {resultados.length > 0 && (
        <div className="grid gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold">Listo</h2>
            <p className="text-xs text-muted-foreground">
              {formatearTamano(pesoOriginal)} → {formatearTamano(pesoFinal)}
              {pesoOriginal > 0 && pesoFinal < pesoOriginal
                ? ` (${Math.round((1 - pesoFinal / pesoOriginal) * 100)}% menos)`
                : ""}
            </p>
          </div>

          {resultados.length > 1 && puedeCompartir(archivosListos) && (
            <Button type="button" className="h-11 gap-2 text-sm" onClick={() => compartir(archivosListos)}>
              <Share2 className="size-4" />
              Compartir las {resultados.length} partes
            </Button>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {resultados.map(({ file, url }, i) => (
              <div key={url} className="overflow-hidden rounded-lg border border-border bg-card">
                <video src={url} controls playsInline preload="metadata" className="max-h-72 w-full bg-black" />
                <div className="grid gap-2 p-3">
                  <div>
                    <div className="truncate text-sm font-medium">
                      {resultados.length > 1 ? `Parte ${i + 1} de ${resultados.length}` : "Video listo"}
                    </div>
                    <div className="text-xs text-muted-foreground">{formatearTamano(file.size)}</div>
                  </div>
                  <div className="flex gap-2">
                    {puedeCompartir([file]) && (
                      <Button type="button" className="h-10 flex-1 gap-1.5" onClick={() => compartir([file])}>
                        <Share2 className="size-4" />
                        Compartir
                      </Button>
                    )}
                    <a
                      href={url}
                      download={file.name}
                      className={cn(buttonVariants({ variant: "outline" }), "h-10 flex-1 gap-1.5")}
                    >
                      <Download className="size-4" />
                      Descargar
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
