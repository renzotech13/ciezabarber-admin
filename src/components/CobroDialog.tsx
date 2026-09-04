import { useState } from "react"
import { Banknote, CreditCard, Loader2, Smartphone } from "lucide-react"
import { METODOS_PAGO, METODO_PAGO_LABEL, type MetodoPago } from "@/lib/types"
import { ModalFicha } from "@/components/ModalFicha"
import { cn } from "@/lib/utils"

const ICONO: Record<MetodoPago, typeof Banknote> = {
  yape_plin: Smartphone,
  tarjeta: CreditCard,
  efectivo: Banknote,
}

/**
 * Dar por atendida una cita es también decir con qué pagó: sin ese dato el
 * arqueo de caja mezcla el efectivo del cajón con lo que entró por Yape o
 * por el POS, y al cerrar el turno la diferencia no significa nada.
 *
 * Se pregunta acá, en el momento de completar, porque es cuando el que cobra
 * lo tiene fresco — pedirlo después es pedirle que se acuerde.
 */
export default function CobroDialog({
  open,
  onOpenChange,
  cliente,
  detalle,
  guardando,
  onConfirmar,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  cliente: string
  detalle?: string
  guardando?: boolean
  onConfirmar: (metodo: MetodoPago) => void
}) {
  const [metodo, setMetodo] = useState<MetodoPago | null>(null)

  return (
    <ModalFicha
      open={open}
      onOpenChange={(v) => {
        if (!v) setMetodo(null)
        onOpenChange(v)
      }}
      mini={detalle ?? "Cita atendida"}
      titulo={`¿Cómo pagó ${cliente}?`}
      ancho="sm:max-w-md"
      pie={
        <button
          onClick={() => metodo && onConfirmar(metodo)}
          disabled={!metodo || guardando}
          className="chip23 on inline-flex items-center gap-2 disabled:opacity-40"
        >
          {guardando && <Loader2 className="size-3.5 animate-spin" />}
          Marcar completada
        </button>
      }
    >
      <div className="grid gap-2">
        {METODOS_PAGO.map((m) => {
          const Icono = ICONO[m]
          return (
            <button
              key={m}
              type="button"
              onClick={() => setMetodo(m)}
              className={cn(
                "chip23 flex items-center gap-2.5 py-3.5 text-left",
                metodo === m && "on",
              )}
            >
              <Icono className="size-4" />
              {METODO_PAGO_LABEL[m]}
            </button>
          )
        })}
      </div>
      <p className="brand-serif mt-3 text-[12px] text-muted-foreground">
        Solo el efectivo tiene que estar en el cajón al cerrar caja; lo demás entra por celular o
        por el POS.
      </p>
    </ModalFicha>
  )
}
