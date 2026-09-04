import { useEffect, useState } from "react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth"
import { METODOS_PAGO, METODO_PAGO_LABEL, type MetodoPago, type Product } from "@/lib/types"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ModalFicha } from "@/components/ModalFicha"
import { cn } from "@/lib/utils"

/**
 * Registrar una venta de producto, disponible para cualquier staff (no solo
 * el superadmin) — la usa quien atiende el mostrador. A propósito solo pide
 * producto y cantidad: el precio es el de venta al público (ya visible en la
 * tienda, no un dato reservado) y no es editable acá, así que quien registra
 * nunca ve ni toca costo de proveedor, comisiones ni el historial de otras
 * ventas — la policy de la BD (0018) le deja INSERT pero ningún SELECT sobre
 * ventas_productos. La sección Control del superadmin es la única que lee
 * esta tabla.
 */
export default function RegistrarVentaDialog({
  productos,
  open,
  onOpenChange,
}: {
  productos: Product[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { session } = useAuth()
  const [productoId, setProductoId] = useState("")
  const [cantidad, setCantidad] = useState("1")
  const [metodo, setMetodo] = useState<MetodoPago | null>(null)
  const [nota, setNota] = useState("")
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!open) return
    setProductoId("")
    setCantidad("1")
    setMetodo(null)
    setNota("")
  }, [open])

  const activos = productos.filter((p) => p.active)
  const producto = activos.find((p) => p.id === productoId)
  const cantidadNum = Number(cantidad)
  const total = producto && Number.isFinite(cantidadNum) ? producto.price * cantidadNum : null

  async function registrar() {
    if (!producto) return toast.error("Elige el producto vendido.")
    if (cantidad.trim() === "" || !Number.isInteger(cantidadNum) || cantidadNum <= 0) {
      return toast.error("La cantidad debe ser un entero mayor a 0.")
    }
    if (cantidadNum > producto.stock) {
      return toast.error(`Solo hay ${producto.stock} en stock de ${producto.name}.`)
    }
    if (!metodo) return toast.error("Marca con qué pagó.")
    if (!session?.user.id) return toast.error("Tu sesión expiró — vuelve a iniciar sesión.")

    setGuardando(true)
    const { error } = await supabase.from("ventas_productos").insert({
      producto_id: producto.id,
      cantidad: cantidadNum,
      precio_unitario: producto.price,
      metodo_pago: metodo,
      nota: nota.trim() || null,
      registrado_por: session.user.id,
    })
    setGuardando(false)
    if (error) {
      toast.error("No se pudo registrar la venta.")
      return
    }
    toast.success(`Venta registrada: ${cantidadNum} × ${producto.name}.`)
    onOpenChange(false)
  }

  return (
    <ModalFicha
      open={open}
      onOpenChange={onOpenChange}
      mini="Tienda del estudio"
      titulo="Registrar venta"
      ancho="sm:max-w-md"
      pie={
        <button onClick={registrar} disabled={guardando} className="chip23 on disabled:opacity-40">
          {guardando ? "Guardando…" : "Registrar venta"}
        </button>
      }
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="brand-serif">Producto</Label>
          <select
            value={productoId}
            onChange={(e) => setProductoId(e.target.value)}
            className="h-11 w-full rounded-none border border-border bg-card px-3 text-sm outline-none focus:border-foreground"
          >
            <option value="">Elegir producto…</option>
            {activos.map((p) => (
              <option key={p.id} value={p.id} disabled={p.stock <= 0}>
                {p.name} — S/ {p.price} {p.stock <= 0 ? "(agotado)" : `(stock ${p.stock})`}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label className="brand-serif">Cantidad</Label>
          <Input
            type="number"
            min={1}
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            className="tnum h-11 max-w-28"
          />
        </div>

        <div className="space-y-2">
          <Label className="brand-serif">¿Con qué pagó?</Label>
          <div className="flex flex-wrap gap-2">
            {METODOS_PAGO.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMetodo(m)}
                className={cn("chip23", metodo === m && "on")}
              >
                {METODO_PAGO_LABEL[m]}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="brand-serif">Nota (opcional)</Label>
          <Input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Para quién, si dejó saldo…" />
        </div>

        {total != null && (
          <div className="border border-border bg-muted/40 px-4 py-3">
            <div className="brand-serif text-[12px] text-muted-foreground">Total a cobrar</div>
            <div className="brand-wide tnum mt-1 text-[24px] leading-none">S/ {total.toFixed(2)}</div>
          </div>
        )}
      </div>
    </ModalFicha>
  )
}
