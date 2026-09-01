import { useEffect, useState } from "react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth"
import type { Product } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

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
  const [nota, setNota] = useState("")
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!open) return
    setProductoId("")
    setCantidad("1")
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
    if (!session?.user.id) return toast.error("Tu sesión expiró — vuelve a iniciar sesión.")

    setGuardando(true)
    const { error } = await supabase.from("ventas_productos").insert({
      producto_id: producto.id,
      cantidad: cantidadNum,
      precio_unitario: producto.price,
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar venta</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Producto</Label>
            <select
              value={productoId}
              onChange={(e) => setProductoId(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus:border-ring"
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
            <Label>Cantidad</Label>
            <Input type="number" min={1} value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Nota (opcional)</Label>
            <Input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Yape, efectivo, cliente…" />
          </div>
          {total != null && (
            <p className="text-sm text-muted-foreground">
              Total a cobrar: <span className="font-semibold text-foreground">S/ {total.toFixed(2)}</span>
            </p>
          )}
          <Button onClick={registrar} disabled={guardando} className="w-full">
            {guardando ? "Guardando…" : "Registrar venta"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
