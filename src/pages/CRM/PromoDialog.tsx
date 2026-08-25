import { useMemo, useState, type FormEvent } from "react"
import { toast } from "sonner"
import { Info, Plus, X } from "lucide-react"
import { enviarPromocion, BotApiError } from "@/lib/botApi"
import { ETIQUETA_CLASSES, type ConversacionResumen, type Etiqueta } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

export default function PromoDialog({
  open,
  onOpenChange,
  etiquetas,
  etiquetasPorCliente,
  conversaciones,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  etiquetas: Etiqueta[]
  etiquetasPorCliente: Map<string, Etiqueta[]>
  conversaciones: ConversacionResumen[]
}) {
  const [plantilla, setPlantilla] = useState("")
  const [parametros, setParametros] = useState<string[]>([])
  const [seleccionadas, setSeleccionadas] = useState<string[]>([])
  const [enviando, setEnviando] = useState(false)

  // Un cliente puede tener varias conversaciones; la campaña va por
  // persona, así que se deduplica por cliente_id.
  const destinatarios = useMemo(() => {
    const ids = new Set<string>()
    for (const c of conversaciones) {
      if (seleccionadas.length > 0) {
        const suyas = etiquetasPorCliente.get(c.cliente_id) ?? []
        if (!suyas.some((e) => seleccionadas.includes(e.id))) continue
      }
      ids.add(c.cliente_id)
    }
    return [...ids]
  }, [conversaciones, etiquetasPorCliente, seleccionadas])

  function alternarEtiqueta(id: string) {
    setSeleccionadas((previas) => (previas.includes(id) ? previas.filter((e) => e !== id) : [...previas, id]))
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (!plantilla.trim() || destinatarios.length === 0) return

    setEnviando(true)
    try {
      const rellenos = parametros.map((p) => p.trim()).filter(Boolean)
      const resultado = await enviarPromocion({
        clienteIds: destinatarios,
        plantilla: plantilla.trim(),
        ...(rellenos.length > 0 ? { parametros: rellenos } : {}),
      })

      if (resultado.fallidas.length > 0) {
        toast.warning(`Enviadas ${resultado.enviadas}, fallaron ${resultado.fallidas.length}.`)
      } else {
        toast.success(`Promoción enviada a ${resultado.enviadas} clienta(s).`)
      }
      onOpenChange(false)
      setPlantilla("")
      setParametros([])
      setSeleccionadas([])
    } catch (err) {
      toast.error(err instanceof BotApiError ? err.message : "No se pudo enviar la promoción.")
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar promoción</DialogTitle>
        </DialogHeader>

        <form onSubmit={enviar} className="flex flex-col gap-4">
          <div className="flex items-start gap-2 rounded-md bg-muted px-3 py-2.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Las campañas salen siempre como <strong>plantilla aprobada por Meta</strong>. Crea la plantilla en el
              Administrador de WhatsApp, espera su aprobación, y escribe aquí su nombre exacto.
            </span>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="promo-plantilla">Nombre de la plantilla</Label>
            <Input
              id="promo-plantilla"
              value={plantilla}
              onChange={(e) => setPlantilla(e.target.value)}
              placeholder="promo_agosto"
              required
            />
          </div>

          <div className="grid gap-2">
            <Label>Variables de la plantilla</Label>
            <p className="text-xs text-muted-foreground">
              En orden, rellenan los {"{{1}}"}, {"{{2}}"}… del cuerpo. Si la cantidad no coincide con la plantilla
              aprobada, Meta rechaza el envío.
            </p>
            {parametros.map((valor, i) => (
              <div key={i} className="flex gap-1.5">
                <Input
                  value={valor}
                  onChange={(e) =>
                    setParametros((previos) => previos.map((p, idx) => (idx === i ? e.target.value : p)))
                  }
                  placeholder={`Valor para {{${i + 1}}}`}
                  className="h-8 text-xs"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2"
                  onClick={() => setParametros((previos) => previos.filter((_, idx) => idx !== i))}
                  aria-label={`Quitar variable ${i + 1}`}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-fit gap-1"
              onClick={() => setParametros((previos) => [...previos, ""])}
            >
              <Plus className="size-3.5" />
              Agregar variable
            </Button>
          </div>

          <div className="grid gap-2">
            <Label>Destinatarias</Label>
            {etiquetas.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Aún no hay etiquetas. Se enviará a todas las clientas con conversación.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {etiquetas.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => alternarEtiqueta(e.id)}
                    className={cn(
                      "rounded px-2 py-1 text-xs font-medium transition-opacity",
                      ETIQUETA_CLASSES[e.color],
                      !seleccionadas.includes(e.id) && "opacity-40",
                    )}
                  >
                    {e.nombre}
                  </button>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {seleccionadas.length === 0
                ? "Sin filtro: todas las clientas con conversación."
                : "Solo quienes tengan alguna de las etiquetas marcadas."}{" "}
              <strong className="text-foreground">{destinatarios.length} destinataria(s).</strong>
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={enviando || !plantilla.trim() || destinatarios.length === 0}>
              {enviando ? "Enviando…" : `Enviar a ${destinatarios.length}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
