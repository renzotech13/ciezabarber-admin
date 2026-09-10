import { useEffect, useRef, useState } from "react"
import { Loader2, User } from "lucide-react"
import { Input } from "@/components/ui/input"
import { buscarClientes, type ClienteSugerido } from "@/lib/clienteBusqueda"
import { cn } from "@/lib/utils"

/**
 * Campo de nombre con sugerencias de clientes ya registrados, a partir de 3
 * letras (menos que eso, con nombres comunes, trae puro ruido).
 *
 * Elegir una sugerencia completa también el teléfono (vía `onSeleccionar`):
 * así el registro cae sobre la MISMA ficha del cliente en vez de crear una
 * homónima, que es lo que de verdad hace falta para que su historial de
 * cortes y sus recompensas se acumulen en un solo lugar.
 */
export function ClienteCombobox({
  id,
  value,
  onChange,
  onSeleccionar,
  placeholder = "Nombre",
  className,
}: {
  id?: string
  value: string
  onChange: (v: string) => void
  onSeleccionar: (cliente: ClienteSugerido) => void
  placeholder?: string
  className?: string
}) {
  const [sugerencias, setSugerencias] = useState<ClienteSugerido[]>([])
  const [buscando, setBuscando] = useState(false)
  // Sin esto, una búsqueda que terminó con cero resultados no se distingue
  // de una que nunca se hizo, y el "sin coincidencias" no llega a mostrarse.
  const [haBuscado, setHaBuscado] = useState(false)
  const [abierto, setAbierto] = useState(false)
  const [resaltado, setResaltado] = useState(0)
  const contenedorRef = useRef<HTMLDivElement>(null)
  const consultaVigente = useRef(0)

  useEffect(() => {
    const q = value.trim()
    if (q.length < 3) {
      setSugerencias([])
      setBuscando(false)
      setHaBuscado(false)
      return
    }
    setBuscando(true)
    const version = ++consultaVigente.current
    const temporizador = setTimeout(async () => {
      const resultado = await buscarClientes(q)
      if (consultaVigente.current !== version) return
      setSugerencias(resultado)
      setBuscando(false)
      setHaBuscado(true)
      setResaltado(0)
    }, 250)
    return () => clearTimeout(temporizador)
  }, [value])

  useEffect(() => {
    function alClickFuera(e: MouseEvent) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener("mousedown", alClickFuera)
    return () => document.removeEventListener("mousedown", alClickFuera)
  }, [])

  function elegir(c: ClienteSugerido) {
    onChange(c.nombre ?? "")
    onSeleccionar(c)
    setAbierto(false)
    setSugerencias([])
  }

  const mostrarLista = abierto && value.trim().length >= 3 && (buscando || haBuscado)

  return (
    <div ref={contenedorRef} className="relative">
      <Input
        id={id}
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setAbierto(true)
        }}
        onFocus={() => setAbierto(true)}
        onKeyDown={(e) => {
          if (!mostrarLista || sugerencias.length === 0) return
          if (e.key === "ArrowDown") {
            e.preventDefault()
            setResaltado((i) => Math.min(i + 1, sugerencias.length - 1))
          } else if (e.key === "ArrowUp") {
            e.preventDefault()
            setResaltado((i) => Math.max(i - 1, 0))
          } else if (e.key === "Enter" && sugerencias[resaltado]) {
            e.preventDefault()
            elegir(sugerencias[resaltado])
          } else if (e.key === "Escape") {
            setAbierto(false)
          }
        }}
        placeholder={placeholder}
        autoComplete="off"
        className={className}
      />
      {mostrarLista && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto border border-border bg-card shadow-lg">
          {buscando && sugerencias.length === 0 ? (
            <div className="flex items-center gap-2 px-3 py-2.5 text-[13px] text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Buscando…
            </div>
          ) : sugerencias.length === 0 ? (
            <div className="px-3 py-2.5 text-[13px] text-muted-foreground">Sin coincidencias: será cliente nuevo.</div>
          ) : (
            sugerencias.map((c, i) => (
              <button
                key={c.id}
                type="button"
                // Evita que el input pierda el foco (y cierre la lista) antes
                // de que el click en el botón llegue a dispararse.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => elegir(c)}
                className={cn(
                  "flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-[13px] transition-colors",
                  i === resaltado ? "bg-muted" : "hover:bg-muted/60",
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <User className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate font-medium">{c.nombre || "Sin nombre"}</span>
                  <span className="shrink-0 text-muted-foreground">{c.telefono}</span>
                </span>
                <span className="brand-serif shrink-0 text-muted-foreground">
                  {c.cortes} corte{c.cortes === 1 ? "" : "s"}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
