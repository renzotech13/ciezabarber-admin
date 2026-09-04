import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Loader2, ShoppingCart } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth"
import { METODOS_PAGO, METODO_PAGO_LABEL, type MetodoPago, type Product } from "@/lib/types"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

/**
 * Registrar la venta de un producto desde el celular, en el momento — sin
 * pedirle a nadie que lo cargue después en la tablet. Entra directo al
 * Control del dueño y descuenta el stock solo (trigger de la 0017).
 *
 * A propósito no muestra historial ni totales: quien registra no puede LEER
 * ventas_productos (eso es solo del superadmin, en Control). Registra a
 * ciegas y ve solo su confirmación.
 */
export default function Vender() {
  const { session } = useAuth()
  const [productos, setProductos] = useState<Product[]>([])
  const [cargando, setCargando] = useState(true)
  const [productoId, setProductoId] = useState("")
  const [cantidad, setCantidad] = useState("1")
  const [metodo, setMetodo] = useState<MetodoPago | null>(null)
  const [nota, setNota] = useState("")
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    supabase
      .from("products")
      .select("*")
      .eq("active", true)
      .order("sort_order")
      .then(({ data, error }) => {
        if (error) toast.error("No se pudieron cargar los productos.")
        else setProductos((data as Product[] | null) ?? [])
        setCargando(false)
      })
  }, [])

  const producto = productos.find((p) => p.id === productoId)
  const cantidadNum = Number(cantidad)
  const total = producto && Number.isFinite(cantidadNum) ? producto.price * cantidadNum : null

  async function registrar() {
    if (!producto) return toast.error("Elige el producto vendido.")
    if (cantidad.trim() === "" || !Number.isInteger(cantidadNum) || cantidadNum <= 0) {
      return toast.error("La cantidad debe ser un entero mayor a 0.")
    }
    if (cantidadNum > producto.stock) {
      return toast.error(`Solo quedan ${producto.stock} de ${producto.name}.`)
    }
    if (!metodo) return toast.error("Marca con qué pagó.")
    if (!session?.user.id) return toast.error("Tu sesión expiró — vuelve a entrar.")

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
    toast.success(`Registrado: ${cantidadNum} × ${producto.name}.`)
    setProductoId("")
    setCantidad("1")
    setMetodo(null)
    setNota("")
    // El stock cambió: se recarga para que el siguiente registro vea el real.
    const { data } = await supabase.from("products").select("*").eq("active", true).order("sort_order")
    setProductos((data as Product[] | null) ?? [])
  }

  if (cargando) {
    return (
      <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Cargando productos…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="brand-display text-[26px]">Vender</h1>

      <div className="space-y-1.5">
        <Label className="brand-serif">Producto</Label>
        <select
          value={productoId}
          onChange={(e) => setProductoId(e.target.value)}
          className="h-12 w-full border border-input bg-card px-3 text-[15px] outline-none focus:border-foreground"
        >
          <option value="">Elegir producto…</option>
          {productos.map((p) => (
            <option key={p.id} value={p.id} disabled={p.stock <= 0}>
              {p.name} — S/ {p.price} {p.stock <= 0 ? "(agotado)" : `(quedan ${p.stock})`}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label className="brand-serif">Cantidad</Label>
        <Input
          type="number"
          min={1}
          inputMode="numeric"
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
          className="tnum h-12"
        />
      </div>

      <div className="space-y-2">
        <Label className="brand-serif">¿Con qué pagó?</Label>
        <div className="grid grid-cols-3 gap-2">
          {METODOS_PAGO.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMetodo(m)}
              className={cn("chip23 py-3 text-[11px]", metodo === m && "on")}
            >
              {METODO_PAGO_LABEL[m]}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="brand-serif">Nota (opcional)</Label>
        <Input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Para quién, si dejó saldo…" className="h-12" />
      </div>

      {total != null && (
        <div className="border border-border bg-card p-4">
          <div className="brand-serif text-[12px] text-muted-foreground">Total a cobrar</div>
          <div className="brand-wide tnum mt-1 text-[30px] leading-none">S/ {total.toFixed(2)}</div>
        </div>
      )}

      <button
        onClick={registrar}
        disabled={guardando}
        className="chip23 on flex w-full items-center justify-center gap-2 py-4 text-[13px] disabled:opacity-40"
      >
        {guardando ? <Loader2 className="size-4 animate-spin" /> : <ShoppingCart className="size-4" />}
        Registrar venta
      </button>
    </div>
  )
}
