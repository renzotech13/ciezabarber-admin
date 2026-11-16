import { useEffect, useRef, useState, type ChangeEvent } from "react"
import { toast } from "sonner"
import { Camera, ImageOff, Loader2, RotateCcw, ScanFace, Sparkles, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { BotApiError, analizarRostro, estadoSimulador, probarCorte } from "@/lib/botApi"
import {
  CLAVE_FORMA,
  etiquetaCabello,
  etiquetaForma,
  prepararFoto,
  type RecomendacionVista,
  type SimulacionVista,
} from "@/lib/simulador"

type Fase = "foto" | "analizando" | "resultado"

const RASGOS: { clave: keyof SimulacionVista["analisis"]["rasgos"]; label: string }[] = [
  { clave: "frente", label: "Frente" },
  { clave: "pomulos", label: "Pómulos" },
  { clave: "mandibula", label: "Mandíbula" },
  { clave: "menton", label: "Mentón" },
  { clave: "craneo", label: "Cráneo" },
  { clave: "entradas", label: "Entradas" },
]

/**
 * Simulador de cortes: foto del cliente → forma del rostro y del cráneo → 2-3 cortes del catálogo con la foto de
 * alguien de rasgos parecidos → (cuando se conecte APIMart) el corte puesto sobre la foto del propio cliente.
 * La misma pieza se usa en el panel y en la app del celular; `compacto` la acomoda al ancho del teléfono.
 */
export function SimuladorCorte({ compacto = false }: { compacto?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [fase, setFase] = useState<Fase>("foto")
  const [preview, setPreview] = useState<string | null>(null)
  const [foto, setFoto] = useState<string | null>(null)
  const [consentimiento, setConsentimiento] = useState(false)
  const [sim, setSim] = useState<SimulacionVista | null>(null)
  const [generacion, setGeneracion] = useState<boolean | null>(null)
  const [probando, setProbando] = useState<string | null>(null)
  const [resultados, setResultados] = useState<Record<string, string>>({})
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    estadoSimulador()
      .then((r) => setGeneracion(r.generacion_disponible))
      .catch(() => setGeneracion(false))
  }, [])

  async function elegirFoto(e: ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    e.target.value = ""
    if (!archivo) return
    try {
      const { base64, dataUrl } = await prepararFoto(archivo)
      setFoto(base64)
      setPreview(dataUrl)
      setAviso(null)
    } catch {
      toast.error("No se pudo leer esa foto. Prueba con otra.")
    }
  }

  async function analizar() {
    if (!foto || !consentimiento) return
    setFase("analizando")
    setAviso(null)
    try {
      const r = await analizarRostro({ imagen_base64: foto, mime: "image/jpeg" })
      setSim(r.simulacion)
      setGeneracion(r.generacion_disponible)
      setResultados(
        Object.fromEntries(r.simulacion.resultados.filter((x) => x.url).map((x) => [x.corte_id, x.url as string])),
      )
      setFase("resultado")
    } catch (err) {
      setFase("foto")
      // Una foto que no sirve no es un error del sistema: se explica qué corregir y se deja tomar otra.
      if (err instanceof BotApiError && err.code === "foto_no_valida") setAviso(err.message)
      else toast.error(err instanceof BotApiError ? err.message : "No se pudo analizar la foto.")
    }
  }

  async function probar(rec: RecomendacionVista) {
    if (!sim || !rec.corte_id) return
    setProbando(rec.corte_id)
    try {
      const r = await probarCorte(sim.id, rec.corte_id)
      if (r.url) setResultados((prev) => ({ ...prev, [rec.corte_id as string]: r.url as string }))
    } catch (err) {
      if (err instanceof BotApiError && err.code === "simulacion_no_configurada") setGeneracion(false)
      toast.error(err instanceof BotApiError ? err.message : "No se pudo generar la imagen.")
    } finally {
      setProbando(null)
    }
  }

  function reiniciar() {
    setFase("foto")
    setPreview(null)
    setFoto(null)
    setConsentimiento(false)
    setSim(null)
    setResultados({})
    setAviso(null)
  }

  if (fase === "resultado" && sim) {
    const a = sim.analisis
    return (
      <div className="grid gap-4">
        <section className={cn("grid gap-4 border border-border bg-card p-4", !compacto && "md:grid-cols-[220px_1fr]")}>
          <FotoCliente url={preview ?? sim.foto_url} compacto={compacto} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="brand-wide text-[11px] text-muted-foreground">Forma del rostro</span>
              <Badge variant={a.seguridad === "alta" ? "default" : "secondary"}>
                {a.seguridad === "alta" ? "Lectura clara" : a.seguridad === "media" ? "Entre dos formas" : "Lectura dudosa"}
              </Badge>
            </div>
            <h2 className="brand-display mt-1 text-3xl leading-none">{etiquetaForma(a.formaRostro)}</h2>
            {CLAVE_FORMA[a.formaRostro] && (
              <p className="mt-1 text-xs text-muted-foreground">{CLAVE_FORMA[a.formaRostro]}</p>
            )}
            <p className="mt-3 text-sm">{a.resumen}</p>
            <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-2">
              {RASGOS.map(({ clave, label }) => (
                <div key={clave} className="flex gap-1.5">
                  <dt className="shrink-0 font-semibold">{label}:</dt>
                  <dd className="text-muted-foreground">{a.rasgos[clave]}</dd>
                </div>
              ))}
              {a.tipoCabello && (
                <div className="flex gap-1.5">
                  <dt className="shrink-0 font-semibold">Cabello:</dt>
                  <dd className="text-muted-foreground">
                    {etiquetaCabello(a.tipoCabello)}
                    {a.densidad ? `, densidad ${a.densidad}` : ""}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </section>

        <div className="flex items-center justify-between gap-2">
          <h3 className="brand-wide text-sm">Cortes recomendados</h3>
          {generacion === false && (
            <span className="text-[11px] text-muted-foreground">La foto con el corte puesto llega pronto</span>
          )}
        </div>

        <div className={cn("grid gap-3", !compacto && "md:grid-cols-2 xl:grid-cols-3")}>
          {sim.recomendaciones.map((rec, i) => (
            <TarjetaCorte
              key={`${rec.corte_id ?? rec.nombre}-${i}`}
              rec={rec}
              resultado={rec.corte_id ? resultados[rec.corte_id] : undefined}
              fotoCliente={preview ?? sim.foto_url}
              generacion={generacion}
              probando={probando === rec.corte_id}
              ocupado={probando !== null}
              onProbar={() => probar(rec)}
            />
          ))}
        </div>

        {a.evitar.length > 0 && (
          <section className="border border-border bg-card p-4">
            <h3 className="brand-wide text-xs text-muted-foreground">Mejor evitar</h3>
            <ul className="mt-2 grid gap-1 text-sm">
              {a.evitar.map((e) => (
                <li key={e} className="flex gap-2">
                  <span aria-hidden className="text-muted-foreground">
                    ×
                  </span>
                  {e}
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="text-[11px] text-muted-foreground">
          Es una guía para conversar con el cliente, no un diagnóstico. La foto se borra sola en 7 días.
        </p>
        <Button variant="outline" onClick={reiniciar} className="justify-self-start">
          <RotateCcw className="size-4" /> Nuevo cliente
        </Button>
      </div>
    )
  }

  const analizando = fase === "analizando"
  return (
    <div className="grid gap-4">
      <section className="grid gap-4 border border-border bg-card p-4">
        <div className="flex gap-3">
          <ScanFace className="mt-0.5 size-5 shrink-0" />
          <div>
            <h2 className="text-sm font-semibold">Foto del cliente</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              De frente, con buena luz, la cara completa y la frente despejada (sin gorra ni lentes oscuros). Si puedes,
              con el cabello hacia atrás: así se ve mejor la forma del cráneo.
            </p>
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="user"
          className="hidden"
          onChange={elegirFoto}
        />

        {preview ? (
          <div className="grid justify-items-start gap-2">
            <img src={preview} alt="Foto del cliente" className="max-h-80 w-auto border border-border object-contain" />
            <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={analizando}>
              <Camera className="size-4" /> Tomar otra
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex min-h-40 flex-col items-center justify-center gap-2 border border-dashed border-border text-sm text-muted-foreground transition-colors hover:bg-muted"
          >
            <Camera className="size-6" />
            Tomar o subir foto
          </button>
        )}

        {aviso && (
          <p className="flex gap-2 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            <TriangleAlert className="size-4 shrink-0" />
            {aviso}
          </p>
        )}

        <label className="flex items-start gap-2 text-xs">
          <input
            type="checkbox"
            checked={consentimiento}
            onChange={(e) => setConsentimiento(e.target.checked)}
            className="mt-0.5 size-4"
          />
          <span>
            El cliente aceptó que se le tome la foto para recomendarle un corte. Se guarda de forma privada y se borra
            sola en 7 días.
          </span>
        </label>

        <Button onClick={analizar} disabled={!foto || !consentimiento || analizando} className="justify-self-start">
          {analizando ? <Loader2 className="size-4 animate-spin" /> : <ScanFace className="size-4" />}
          {analizando ? "Analizando el rostro…" : "Analizar rostro"}
        </Button>
      </section>
    </div>
  )
}

function FotoCliente({ url, compacto }: { url: string | null; compacto: boolean }) {
  if (!url) {
    return (
      <div className="flex aspect-[3/4] items-center justify-center bg-muted text-muted-foreground">
        <ImageOff className="size-6" />
      </div>
    )
  }
  return (
    <img
      src={url}
      alt="Foto del cliente"
      className={cn("aspect-[3/4] w-full border border-border object-cover", compacto && "max-h-72 w-auto justify-self-start")}
    />
  )
}

function TarjetaCorte({
  rec,
  resultado,
  fotoCliente,
  generacion,
  probando,
  ocupado,
  onProbar,
}: {
  rec: RecomendacionVista
  resultado?: string
  fotoCliente: string | null
  generacion: boolean | null
  probando: boolean
  ocupado: boolean
  onProbar: () => void
}) {
  return (
    <article className="grid content-start gap-3 border border-border bg-card p-3">
      <div className="grid grid-cols-2 gap-2">
        <figure className="grid gap-1">
          {rec.referencia_url ? (
            <img src={rec.referencia_url} alt={`Referencia: ${rec.nombre}`} className="aspect-[3/4] w-full object-cover" />
          ) : (
            <div className="flex aspect-[3/4] items-center justify-center bg-muted p-2 text-center text-[11px] text-muted-foreground">
              Sin foto en el catálogo
            </div>
          )}
          <figcaption className="text-[10px] text-muted-foreground">Referencia</figcaption>
        </figure>
        <figure className="grid gap-1">
          {resultado ? (
            <img src={resultado} alt={`El cliente con ${rec.nombre}`} className="aspect-[3/4] w-full object-cover" />
          ) : (
            <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted">
              {fotoCliente && <img src={fotoCliente} alt="" className="size-full object-cover opacity-40 grayscale" />}
              <div className="absolute inset-0 flex items-center justify-center p-2 text-center text-[11px] font-medium">
                {probando ? <Loader2 className="size-5 animate-spin" /> : "Así le quedaría"}
              </div>
            </div>
          )}
          <figcaption className="text-[10px] text-muted-foreground">El cliente</figcaption>
        </figure>
      </div>
      <div>
        <h4 className="font-semibold leading-tight">{rec.nombre}</h4>
        <p className="mt-1 text-xs text-muted-foreground">{rec.motivo}</p>
      </div>
      {!resultado && (
        <Button
          size="sm"
          variant={generacion ? "default" : "outline"}
          disabled={!rec.corte_id || !generacion || ocupado}
          onClick={onProbar}
          title={
            !rec.corte_id
              ? "Este corte no está en el catálogo: agrégalo con una foto para poder probarlo."
              : generacion === false
                ? "Falta conectar el generador de imágenes."
                : undefined
          }
        >
          <Sparkles className="size-4" />
          {probando ? "Generando…" : !rec.corte_id ? "No está en el catálogo" : generacion ? "Probar en el cliente" : "Probar (próximamente)"}
        </Button>
      )}
    </article>
  )
}
