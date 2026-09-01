import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Loader2, Save, ImageOff } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useServiceNames } from "@/lib/services"
import { COMPROBANTE_ESTADO_LABEL, CITA_ESTADO_LABEL, type Cita, type FichaCliente } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

function fechaCorta(iso: string) {
  return new Date(iso).toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" })
}

const ORIGEN_LABEL = { whatsapp: "por WhatsApp", web: "desde la web" } as const

/**
 * Todo lo que el staff necesita de una reserva sin salir de la tabla: la
 * constancia del adelanto, la ficha del cliente y qué se le hizo las veces
 * anteriores. El "historial clínico" de la barbería: antes de atender, el
 * barbero abre la fila y ve el corte de la última vez y sus preferencias.
 */
export default function FichaReserva({ cita }: { cita: Cita & { clientes: { nombre: string | null; telefono: string } } }) {
  const { serviceName } = useServiceNames()
  const [ficha, setFicha] = useState<FichaCliente | null>(null)
  const [historial, setHistorial] = useState<Cita[]>([])
  const [comprobanteUrl, setComprobanteUrl] = useState<string | null>(null)
  const [comprobanteRoto, setComprobanteRoto] = useState(false)
  const [cargando, setCargando] = useState(true)

  const [preferencias, setPreferencias] = useState("")
  const [alergias, setAlergias] = useState("")
  const [notas, setNotas] = useState("")
  const [atencion, setAtencion] = useState("")
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    let activo = true
    setCargando(true)
    setComprobanteRoto(false)

    async function cargar() {
      const [clienteRes, historialRes] = await Promise.all([
        supabase
          .from("clientes")
          .select("id, nombre, telefono, email, notas, preferencias, alergias, created_at")
          .eq("id", cita.cliente_id)
          .maybeSingle(),
        // Solo visitas ya ocurridas: el historial es lo que se le hizo, no lo
        // que tiene agendado hacia adelante.
        supabase
          .from("citas")
          .select("*")
          .eq("cliente_id", cita.cliente_id)
          .neq("id", cita.id)
          .lt("inicio_utc", new Date().toISOString())
          .in("estado", ["completada", "confirmada", "no_asistio"])
          .order("inicio_utc", { ascending: false })
          .limit(8),
      ])
      if (!activo) return

      const cliente = (clienteRes.data as FichaCliente | null) ?? null
      setFicha(cliente)
      setPreferencias(cliente?.preferencias ?? "")
      setAlergias(cliente?.alergias ?? "")
      setNotas(cliente?.notas ?? "")
      setAtencion(cita.atencion_notas ?? "")
      setHistorial((historialRes.data as Cita[] | null) ?? [])

      // El bucket es privado: la imagen solo se ve con una URL firmada, que
      // caduca sola en una hora.
      if (cita.comprobante_path) {
        const { data } = await supabase.storage.from("comprobantes").createSignedUrl(cita.comprobante_path, 3600)
        if (activo) setComprobanteUrl(data?.signedUrl ?? null)
      } else {
        setComprobanteUrl(null)
      }
      if (activo) setCargando(false)
    }
    cargar()
    return () => {
      activo = false
    }
  }, [cita.id, cita.cliente_id, cita.comprobante_path, cita.atencion_notas])

  async function guardar() {
    setGuardando(true)
    // La ficha vive en el cliente y la nota de atención en la cita: son dos
    // tablas distintas, pero para el barbero es un solo botón "Guardar".
    const [clienteRes, citaRes] = await Promise.all([
      supabase
        .from("clientes")
        .update({
          preferencias: preferencias.trim() || null,
          alergias: alergias.trim() || null,
          notas: notas.trim() || null,
        })
        .eq("id", cita.cliente_id),
      supabase.from("citas").update({ atencion_notas: atencion.trim() || null }).eq("id", cita.id),
    ])
    setGuardando(false)
    if (clienteRes.error || citaRes.error) toast.error("No se pudo guardar la ficha.")
    else toast.success("Ficha guardada.")
  }

  if (cargando) {
    return (
      <div className="flex items-center gap-2 px-4 py-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Cargando la ficha…
      </div>
    )
  }

  return (
    <div className="grid gap-6 px-4 py-5 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)_minmax(0,1fr)]">
      {/* --- comprobante del adelanto --- */}
      <section className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Adelanto</h4>
        {cita.comprobante_path ? (
          <>
            {comprobanteUrl && !comprobanteRoto ? (
              <a href={comprobanteUrl} target="_blank" rel="noreferrer" title="Abrir en tamaño completo">
                <img
                  src={comprobanteUrl}
                  alt="Constancia del adelanto"
                  onError={() => setComprobanteRoto(true)}
                  className="max-h-72 w-full rounded-md border border-border bg-muted object-contain"
                />
              </a>
            ) : (
              <div className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-6 text-xs text-muted-foreground">
                <ImageOff className="size-4" /> No se pudo cargar la imagen.
              </div>
            )}
            <div className="space-y-0.5 text-xs">
              <div
                className={cn(
                  "font-medium",
                  cita.comprobante_estado === "confirmado" ? "text-[var(--status-confirmed)]" : "text-[var(--status-pending)]",
                )}
              >
                {COMPROBANTE_ESTADO_LABEL[cita.comprobante_estado]}
                {cita.comprobante_monto_detectado != null && ` · S/ ${cita.comprobante_monto_detectado}`}
              </div>
              <div className="text-muted-foreground">
                {cita.deposito_esperado != null && `Esperado S/ ${cita.deposito_esperado}`}
                {cita.comprobante_origen && ` · Llegó ${ORIGEN_LABEL[cita.comprobante_origen]}`}
              </div>
              {cita.comprobante_nota && <p className="text-muted-foreground">{cita.comprobante_nota}</p>}
            </div>
          </>
        ) : (
          <div className="rounded-md border border-dashed border-border px-3 py-6 text-xs text-muted-foreground">
            {cita.estado === "pendiente_pago"
              ? `Todavía no envía la constancia${cita.deposito_esperado != null ? ` de S/ ${cita.deposito_esperado}` : ""}.`
              : "Sin comprobante registrado."}
          </div>
        )}
      </section>

      {/* --- historial de visitas --- */}
      <section className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Historial {ficha && `· cliente desde ${fechaCorta(ficha.created_at)}`}
        </h4>
        {historial.length === 0 ? (
          <p className="text-xs text-muted-foreground">Primera visita: no hay atenciones anteriores registradas.</p>
        ) : (
          <ul className="space-y-2">
            {historial.map((h) => (
              <li key={h.id} className="rounded-md border border-border px-3 py-2 text-xs">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">{serviceName(h.servicio_id)}</span>
                  <span className="shrink-0 text-muted-foreground">{fechaCorta(h.inicio_utc)}</span>
                </div>
                <div className="text-muted-foreground">
                  {h.barbero ?? "Sin barbero"}
                  {h.estado !== "completada" && ` · ${CITA_ESTADO_LABEL[h.estado]}`}
                </div>
                {h.atencion_notas && <p className="mt-1 whitespace-pre-wrap text-foreground">{h.atencion_notas}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* --- ficha editable --- */}
      <section className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ficha del cliente</h4>

        <div className="space-y-1.5">
          <Label htmlFor={`atencion-${cita.id}`} className="text-xs">
            Qué se le hizo en esta visita
          </Label>
          <Textarea
            id={`atencion-${cita.id}`}
            value={atencion}
            onChange={(e) => setAtencion(e.target.value)}
            placeholder="Fade medio, máquina 1 a los lados, tijera arriba…"
            rows={3}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`pref-${cita.id}`} className="text-xs">
            Gustos y preferencias
          </Label>
          <Textarea
            id={`pref-${cita.id}`}
            value={preferencias}
            onChange={(e) => setPreferencias(e.target.value)}
            placeholder="Siempre pide barba perfilada, no le gusta el secador…"
            rows={2}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`alergias-${cita.id}`} className="text-xs">
            Alergias y cuidados
          </Label>
          <Textarea
            id={`alergias-${cita.id}`}
            value={alergias}
            onChange={(e) => setAlergias(e.target.value)}
            placeholder="Piel sensible al after shave con alcohol…"
            rows={2}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`notas-${cita.id}`} className="text-xs">
            Otras notas
          </Label>
          <Textarea
            id={`notas-${cita.id}`}
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Cualquier otro dato del cliente"
            rows={2}
          />
        </div>

        <Button size="sm" onClick={guardar} disabled={guardando}>
          {guardando ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
          Guardar ficha
        </Button>
      </section>
    </div>
  )
}
