import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth"
import type { Product } from "@/lib/types"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { GraficoBarrasH, GraficoLinea } from "./charts"
import { Ficha, CabeceraFicha, Tile } from "./ui"
import {
  type Rango, listarDias, inicioDiaLimaUTC, finDiaLimaUTC, diaLimaDe,
  etiquetaCorta, etiquetaLarga, formatoSoles,
} from "./rango"

type Venta = {
  id: string
  producto_id: string
  cantidad: number
  precio_unitario: number
  vendido_at: string
  nota: string | null
  products: { name: string }
}

const UMBRAL_STOCK_BAJO = 3

function EstadoStock({ stock }: { stock: number }) {
  if (stock <= 0) {
    return <span className="brand-wide bg-status-cancelled-bg px-2 py-1 text-[10px] text-status-cancelled">Agotado</span>
  }
  if (stock <= UMBRAL_STOCK_BAJO) {
    return <span className="brand-wide bg-status-pending-bg px-2 py-1 text-[10px] text-status-pending">Bajo</span>
  }
  return <span className="brand-wide bg-status-confirmed-bg px-2 py-1 text-[10px] text-status-confirmed">OK</span>
}

/** Input de stock que guarda al salir del campo o con Enter. */
function StockEditable({ producto, alGuardar }: { producto: Product; alGuardar: () => void }) {
  const [valor, setValor] = useState(String(producto.stock))
  useEffect(() => setValor(String(producto.stock)), [producto.stock])

  async function guardar() {
    // Un input numérico vacío entrega "" y Number("") es 0: sin este guard,
    // borrar el campo y hacer click fuera pondría el stock en cero.
    if (valor.trim() === "") {
      setValor(String(producto.stock))
      return
    }
    const n = Number(valor)
    if (!Number.isInteger(n) || n < 0) {
      setValor(String(producto.stock))
      return
    }
    if (n === producto.stock) return
    const { error } = await supabase.from("products").update({ stock: n }).eq("id", producto.id)
    if (error) {
      toast.error("No se pudo actualizar el stock.")
      setValor(String(producto.stock))
      return
    }
    toast.success(`Stock de ${producto.name}: ${n}.`)
    alGuardar()
  }

  return (
    <Input
      type="number"
      min={0}
      value={valor}
      onChange={(e) => setValor(e.target.value)}
      onBlur={guardar}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      className="tnum h-8 w-20 text-right"
    />
  )
}

export default function Productos({ rango }: { rango: Rango }) {
  const { session } = useAuth()
  const [productos, setProductos] = useState<Product[]>([])
  const [ventas, setVentas] = useState<Venta[]>([])
  const [cargando, setCargando] = useState(true)

  const [dialogAbierto, setDialogAbierto] = useState(false)
  const [ventaProducto, setVentaProducto] = useState("")
  const [ventaCantidad, setVentaCantidad] = useState("1")
  const [ventaPrecio, setVentaPrecio] = useState("")
  const [ventaNota, setVentaNota] = useState("")
  const [guardandoVenta, setGuardandoVenta] = useState(false)
  const [anulando, setAnulando] = useState<string | null>(null)
  const [visibles, setVisibles] = useState(25)
  // Solo la última carga lanzada escribe estado (ver Comisiones.tsx).
  const versionCarga = useRef(0)

  const cargar = useCallback(async () => {
    const version = ++versionCarga.current
    const [prodRes, ventasRes] = await Promise.all([
      supabase.from("products").select("*").order("sort_order"),
      supabase
        .from("ventas_productos")
        .select("*, products!inner(name)")
        .gte("vendido_at", inicioDiaLimaUTC(rango.desde))
        .lt("vendido_at", finDiaLimaUTC(rango.hasta))
        .order("vendido_at", { ascending: false }),
    ])
    if (version !== versionCarga.current) return
    if (prodRes.error || ventasRes.error) {
      toast.error("No se pudieron cargar productos o ventas.")
      setProductos([])
      setVentas([])
    } else {
      setProductos(prodRes.data as Product[])
      setVentas(ventasRes.data as unknown as Venta[])
    }
    setCargando(false)
  }, [rango.desde, rango.hasta])

  // Al cambiar de periodo, la lista de ventas vuelve a su tamaño inicial.
  useEffect(() => setVisibles(25), [rango.desde, rango.hasta])

  useEffect(() => {
    setCargando(true)
    cargar()
  }, [cargar])

  const { unidades, ingresos, porProducto } = useMemo(() => {
    let unidades = 0
    let ingresos = 0
    const porProducto = new Map<string, { nombre: string; unidades: number; ingresos: number }>()
    for (const v of ventas) {
      unidades += v.cantidad
      ingresos += v.cantidad * v.precio_unitario
      const acc = porProducto.get(v.producto_id) ?? { nombre: v.products.name, unidades: 0, ingresos: 0 }
      acc.unidades += v.cantidad
      acc.ingresos += v.cantidad * v.precio_unitario
      porProducto.set(v.producto_id, acc)
    }
    return { unidades, ingresos, porProducto }
  }, [ventas])

  const activos = useMemo(() => productos.filter((p) => p.active), [productos])
  const valorStock = activos.reduce((s, p) => s + p.stock * p.price, 0)
  const agotados = activos.filter((p) => p.stock <= 0).length

  const topVendidos = useMemo(
    () =>
      [...porProducto.values()]
        .sort((a, b) => b.unidades - a.unidades)
        .slice(0, 8)
        .map((p) => ({
          etiqueta: p.nombre.length > 42 ? `${p.nombre.slice(0, 42)}…` : p.nombre,
          valor: p.unidades,
          textoValor: `${p.unidades} und · ${formatoSoles(p.ingresos)}`,
          color: "var(--foreground)",
        })),
    [porProducto],
  )

  const hoy = diaLimaDe(new Date().toISOString())
  const lineaVentas = useMemo(() => {
    const porDia = new Map<string, number>()
    for (const v of ventas) {
      const d = diaLimaDe(v.vendido_at)
      porDia.set(d, (porDia.get(d) ?? 0) + v.cantidad * v.precio_unitario)
    }
    return listarDias(rango)
      .filter((d) => d <= hoy)
      .map((d) => ({ etiqueta: etiquetaCorta(d), etiquetaLarga: etiquetaLarga(d), valor: porDia.get(d) ?? 0 }))
  }, [ventas, rango, hoy])

  function abrirDialog() {
    setVentaProducto("")
    setVentaCantidad("1")
    setVentaPrecio("")
    setVentaNota("")
    setDialogAbierto(true)
  }

  function elegirProducto(id: string) {
    setVentaProducto(id)
    const p = productos.find((x) => x.id === id)
    // El precio del catálogo es el punto de partida, editable por si hubo
    // descuento en mostrador.
    if (p) setVentaPrecio(String(p.price))
  }

  async function registrarVenta() {
    if (!ventaProducto) return toast.error("Elige el producto vendido.")
    // "" convierte a 0 y pasaría los checks numéricos: vacío se rechaza antes.
    if (ventaCantidad.trim() === "" || ventaPrecio.trim() === "") {
      return toast.error("Completa cantidad y precio.")
    }
    const cantidad = Number(ventaCantidad)
    const precio = Number(ventaPrecio)
    if (!Number.isInteger(cantidad) || cantidad <= 0) return toast.error("La cantidad debe ser un entero mayor a 0.")
    if (!Number.isFinite(precio) || precio < 0) return toast.error("Revisa el precio unitario.")

    // La BD también lo garantiza (CHECK stock >= 0 revienta el trigger), pero
    // acá el mensaje es legible en vez de un error de constraint.
    const producto = productos.find((x) => x.id === ventaProducto)
    if (producto && cantidad > producto.stock) {
      return toast.error(`Solo hay ${producto.stock} en stock de ${producto.name} — ajusta el stock primero si se vendió igual.`)
    }

    setGuardandoVenta(true)
    const { error } = await supabase.from("ventas_productos").insert({
      producto_id: ventaProducto,
      cantidad,
      precio_unitario: precio,
      nota: ventaNota.trim() || null,
      registrado_por: session?.user.id ?? null,
    })
    setGuardandoVenta(false)
    if (error) {
      toast.error("No se pudo registrar la venta.")
      return
    }
    toast.success("Venta registrada; el stock se descontó solo.")
    setDialogAbierto(false)
    cargar()
  }

  async function anularVenta(venta: Venta) {
    if (anulando) return
    if (!window.confirm(`¿Anular la venta de ${venta.cantidad} × ${venta.products.name}? El stock se repone.`)) return
    setAnulando(venta.id)
    const { error } = await supabase.from("ventas_productos").delete().eq("id", venta.id)
    if (error) {
      setAnulando(null)
      toast.error("No se pudo anular la venta.")
      return
    }
    toast.success("Venta anulada y stock repuesto.")
    await cargar()
    setAnulando(null)
  }

  if (cargando) {
    return (
      <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Cargando productos…
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile etiqueta="Unidades vendidas" valor={String(unidades)} />
        <Tile etiqueta="Ingresos por productos" valor={formatoSoles(ingresos)} />
        <Tile etiqueta="Valor del stock" valor={formatoSoles(valorStock)} detalle={`${activos.length} activos`} />
        <Tile etiqueta="Agotados" valor={String(agotados)} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[2fr_3fr]">
        <Ficha>
          <CabeceraFicha mini="Los que más salen" titulo="Top vendidos" />
          <div className="px-5 py-4">
            {topVendidos.length === 0
              ? <p className="brand-serif py-10 text-center text-sm text-muted-foreground">Sin ventas registradas en este periodo.</p>
              : <GraficoBarrasH items={topVendidos} />}
          </div>
        </Ficha>

        <Ficha>
          <CabeceraFicha mini="Ingresos por día" titulo="Ventas del periodo" />
          <div className="px-5 py-4">
            <GraficoLinea puntos={lineaVentas} formatoValor={(v) => formatoSoles(v)} />
          </div>
        </Ficha>
      </div>

      <Ficha>
        <CabeceraFicha
          mini="Inventario MUK"
          titulo="Stock por producto"
          extra={
            <button onClick={abrirDialog} className="chip23 on inline-flex items-center gap-1.5">
              <Plus className="size-3" /> Registrar venta
            </button>
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="brand-serif px-4 py-2.5 font-normal text-muted-foreground">Producto</th>
                <th className="brand-wide px-3 py-2.5 text-right text-[10px]">Precio</th>
                <th className="brand-wide px-3 py-2.5 text-right text-[10px]">Vendidos</th>
                <th className="brand-wide px-3 py-2.5 text-right text-[10px]">Stock</th>
                <th className="brand-wide px-4 py-2.5 text-left text-[10px]">Estado</th>
              </tr>
            </thead>
            <tbody>
              {activos.map((p) => (
                <tr key={p.id} className="border-b border-border/60 last:border-b-0">
                  <td className="max-w-72 truncate px-4 py-2">
                    {p.name}
                    {p.linea && <span className="brand-serif text-muted-foreground"> · {p.linea}</span>}
                  </td>
                  <td className="tnum px-3 py-2 text-right">{formatoSoles(p.price)}</td>
                  <td className="tnum px-3 py-2 text-right">{porProducto.get(p.id)?.unidades ?? 0}</td>
                  <td className="px-3 py-2 text-right">
                    <StockEditable producto={p} alGuardar={cargar} />
                  </td>
                  <td className="px-4 py-2"><EstadoStock stock={p.stock} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Ficha>

      <Ficha>
        <CabeceraFicha mini="Movimientos del periodo" titulo={`Ventas registradas (${ventas.length})`} />
        {ventas.length === 0 ? (
          <p className="brand-serif px-5 py-8 text-center text-sm text-muted-foreground">
            Todavía no hay ventas en este periodo. Regístralas con el botón "Registrar venta".
          </p>
        ) : (
          <ul>
            {ventas.slice(0, visibles).map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-2.5 text-[13px] last:border-b-0">
                <div className="min-w-0">
                  <span className="tnum font-semibold">{v.cantidad} ×</span> {v.products.name}
                  {v.nota && <span className="brand-serif text-muted-foreground"> · {v.nota}</span>}
                  <span className="brand-serif text-muted-foreground"> · {etiquetaLarga(diaLimaDe(v.vendido_at))}</span>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="tnum font-semibold">{formatoSoles(v.cantidad * v.precio_unitario)}</span>
                  <button
                    onClick={() => anularVenta(v)}
                    disabled={anulando != null}
                    title="Anular venta (repone stock)"
                    className="text-muted-foreground transition-colors hover:text-destructive disabled:opacity-40"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </li>
            ))}
            {ventas.length > visibles && (
              <li className="px-5 py-3">
                <button onClick={() => setVisibles((v) => v + 25)} className="chip23">
                  Mostrar {Math.min(25, ventas.length - visibles)} más ({ventas.length - visibles} restantes)
                </button>
              </li>
            )}
          </ul>
        )}
      </Ficha>

      <Dialog open={dialogAbierto} onOpenChange={setDialogAbierto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="brand-display text-[20px]">Registrar venta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="brand-serif">Producto</Label>
              <select
                value={ventaProducto}
                onChange={(e) => elegirProducto(e.target.value)}
                className="h-9 w-full border border-input bg-card px-3 text-sm outline-none focus:border-foreground"
              >
                <option value="">Elegir producto…</option>
                {activos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — S/ {p.price} (stock {p.stock})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="brand-serif">Cantidad</Label>
                <Input type="number" min={1} value={ventaCantidad} onChange={(e) => setVentaCantidad(e.target.value)} className="tnum" />
              </div>
              <div className="space-y-1.5">
                <Label className="brand-serif">Precio unitario (S/)</Label>
                <Input type="number" min={0} step="0.1" value={ventaPrecio} onChange={(e) => setVentaPrecio(e.target.value)} className="tnum" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="brand-serif">Nota (opcional)</Label>
              <Input value={ventaNota} onChange={(e) => setVentaNota(e.target.value)} placeholder="Yape, efectivo, cliente…" />
            </div>
            <button onClick={registrarVenta} disabled={guardandoVenta} className="chip23 on w-full py-3 text-[13px] disabled:opacity-40">
              {guardandoVenta ? "Guardando…" : "Registrar venta"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
