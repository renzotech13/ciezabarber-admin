import type { ReactNode } from "react"
import { X } from "lucide-react"
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

/**
 * Los modales del panel con la misma piel que las fichas: esquina viva, filete
 * de 1px, cabecera con el mini en serif sobre el titular en Archivo ancha.
 *
 * El shadcn de fábrica (esquina redonda, sombra, título en 16px medium) se veía
 * como un panel genérico pegado encima del sitio; esto reusa el lenguaje que ya
 * habla Control para que abrir un modal no cambie de marca a medio camino.
 */
export function ModalFicha({
  open,
  onOpenChange,
  mini,
  titulo,
  ancho = "sm:max-w-md",
  children,
  pie,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  mini: string
  titulo: string
  /** Ancho a partir de sm: (en móvil el modal siempre ocupa el ancho útil). */
  ancho?: string
  children: ReactNode
  pie?: ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn("gap-0 rounded-none border border-border bg-card p-0 ring-0", ancho)}
      >
        <header className="flex items-start justify-between gap-4 border-b border-border px-5 pb-4 pt-5">
          <div className="min-w-0">
            <p className="brand-serif text-[13px] text-muted-foreground">{mini}</p>
            <DialogTitle className="brand-display mt-1 text-[19px]">{titulo}</DialogTitle>
          </div>
          <DialogClose
            aria-label="Cerrar"
            className="-mr-1 -mt-1 shrink-0 p-1.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="size-4" />
          </DialogClose>
        </header>

        {/* En pantallas bajas el formulario largo se desplaza solo dentro del
            modal; la cabecera y el pie se quedan fijos. */}
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>

        {pie && (
          <div className="flex items-center justify-end gap-2 border-t border-border bg-muted/40 px-5 py-3">
            {pie}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
