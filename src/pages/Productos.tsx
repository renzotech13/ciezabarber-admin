import { useEffect, useState, type FormEvent } from "react"
import { toast } from "sonner"
import { ArrowDown, ArrowUp, Pencil, Plus, ShoppingCart } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { PRODUCT_TAGS, type Product, type ProductTag } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ModalFicha } from "@/components/ModalFicha"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { ImagePicker } from "@/components/ImagePicker"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import RegistrarVentaDialog from "@/components/RegistrarVentaDialog"

const UMBRAL_STOCK_BAJO = 3

/** Se lee de un vistazo: importa si hay que reponer, no el número pelado. */
function EstadoStock({ stock }: { stock: number }) {
  if (stock <= 0) {
    return <span className="brand-wide bg-status-cancelled-bg px-2 py-1 text-[10px] text-status-cancelled">Agotado</span>
  }
  if (stock <= UMBRAL_STOCK_BAJO) {
    return <span className="brand-wide bg-status-pending-bg px-2 py-1 text-[10px] text-status-pending">Quedan {stock}</span>
  }
  return <span className="tnum text-sm">{stock}</span>
}

function ProductFormDialog({
  open,
  onOpenChange,
  product,
  nextSortOrder,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: Product | null
  nextSortOrder: number
  onSaved: () => void
}) {
  const isEdit = !!product
  const [name, setName] = useState("")
  const [price, setPrice] = useState("")
  const [stock, setStock] = useState("0")
  const [description, setDescription] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  const [linea, setLinea] = useState("")
  const [tags, setTags] = useState<ProductTag[]>([])
  const [active, setActive] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(product?.name ?? "")
    setPrice(product ? String(product.price) : "")
    setStock(product ? String(product.stock) : "0")
    setDescription(product?.description ?? "")
    setImageUrl(product?.image_url ?? "")
    setLinea(product?.linea ?? "")
    setTags(product?.tags ?? [])
    setActive(product?.active ?? true)
  }, [open, product])

  function toggleTag(tag: ProductTag) {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const stockNum = Number(stock)
    if (stock.trim() === "" || !Number.isInteger(stockNum) || stockNum < 0) {
      return toast.error("El stock tiene que ser un entero de 0 para arriba.")
    }
    setSubmitting(true)
    const payload = {
      name: name.trim(),
      price: Number(price),
      description: description.trim(),
      image_url: imageUrl.trim() || null,
      linea: linea.trim() || null,
      tags,
      active,
    }
    // El stock solo se escribe si de verdad se tocó: mientras el modal está
    // abierto puede haberse vendido algo y el trigger de la BD ya lo descontó
    // — mandar el valor viejo sin querer repondría esa unidad.
    const stockCambiado = !isEdit || stockNum !== product!.stock

    const { error } = isEdit
      ? await supabase
          .from("products")
          .update(stockCambiado ? { ...payload, stock: stockNum } : payload)
          .eq("id", product!.id)
      : await supabase.from("products").insert({ ...payload, stock: stockNum, sort_order: nextSortOrder })

    setSubmitting(false)
    if (error) {
      toast.error(isEdit ? "No se pudo guardar el producto." : "No se pudo crear el producto.")
      return
    }
    toast.success(isEdit ? "Producto actualizado." : "Producto creado.")
    onOpenChange(false)
    onSaved()
  }

  return (
    <ModalFicha
      open={open}
      onOpenChange={onOpenChange}
      mini={isEdit ? "Tienda del estudio" : "Catálogo MUK"}
      titulo={isEdit ? "Editar producto" : "Nuevo producto"}
      ancho="sm:max-w-lg"
      pie={
        <button type="submit" form="prod-form" disabled={submitting} className="chip23 on disabled:opacity-40">
          {submitting ? "Guardando…" : "Guardar"}
        </button>
      }
    >
      <form id="prod-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="prod-name" className="brand-serif">Nombre</Label>
          <Input id="prod-name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="prod-price" className="brand-serif">Precio (S/)</Label>
            <Input
              id="prod-price"
              type="number"
              step="0.01"
              min="0"
              required
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="tnum"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="prod-stock" className="brand-serif">Stock (unidades)</Label>
            <Input
              id="prod-stock"
              type="number"
              min="0"
              step="1"
              required
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              className="tnum"
            />
          </div>
        </div>
        <p className="brand-serif -mt-2 text-[12px] text-muted-foreground">
          Se descuenta solo con cada venta registrada, y vuelve a subir si se anula una. Edítalo acá solo
          cuando llegue mercadería o cuando cuentes lo que hay en vitrina.
        </p>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="prod-desc" className="brand-serif">Descripción</Label>
          <Textarea id="prod-desc" required rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <ImagePicker
          label="Imagen (opcional)"
          value={imageUrl || null}
          onChange={(url) => setImageUrl(url ?? "")}
        />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="prod-linea" className="brand-serif">Línea (opcional)</Label>
          <Input id="prod-linea" placeholder="Ej. Deep, Fat, mr. muk" value={linea} onChange={(e) => setLinea(e.target.value)} />
        </div>

        <div className="flex flex-col gap-2">
          <Label className="brand-serif">Categorías (filtros de la tienda)</Label>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {PRODUCT_TAGS.map((t) => (
              <label key={t.value} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  className="size-4 rounded border-input accent-primary"
                  checked={tags.includes(t.value)}
                  onChange={() => toggleTag(t.value)}
                />
                {t.label}
              </label>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2.5 border border-border px-3 py-2.5">
          <Switch id="prod-active" checked={active} onCheckedChange={setActive} />
          <span className="brand-serif text-[13px]">Activo (visible en el sitio)</span>
        </label>
      </form>
    </ModalFicha>
  )
}

export default function Productos() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [ventaDialogOpen, setVentaDialogOpen] = useState(false)

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.from("products").select("*").order("sort_order")
    if (error) {
      toast.error("No se pudieron cargar los productos.")
    } else {
      setProducts(data as Product[])
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
    const channel = supabase
      .channel("products-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, load)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= products.length) return
    const a = products[index]
    const b = products[target]
    const previous = products
    const reordered = [...products]
    reordered[index] = { ...b, sort_order: a.sort_order }
    reordered[target] = { ...a, sort_order: b.sort_order }
    reordered.sort((x, y) => x.sort_order - y.sort_order)
    setProducts(reordered)

    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from("products").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("products").update({ sort_order: a.sort_order }).eq("id", b.id),
    ])
    if (e1 || e2) {
      setProducts(previous)
      toast.error("No se pudo reordenar.")
    }
  }

  async function toggleActive(product: Product) {
    const previous = products
    setProducts((rows) => rows.map((p) => (p.id === product.id ? { ...p, active: !p.active } : p)))
    const { error } = await supabase.from("products").update({ active: !product.active }).eq("id", product.id)
    if (error) {
      setProducts(previous)
      toast.error("No se pudo actualizar.")
    } else {
      toast.success(product.active ? "Producto archivado." : "Producto reactivado.")
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Productos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            El catálogo MUK que se muestra en la tienda del sitio.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setVentaDialogOpen(true)}>
            <ShoppingCart className="size-4" />
            Registrar venta
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setEditing(null)
              setDialogOpen(true)
            }}
          >
            <Plus className="size-4" />
            Nuevo producto
          </Button>
        </div>
      </div>

      <RegistrarVentaDialog productos={products} open={ventaDialogOpen} onOpenChange={setVentaDialogOpen} />

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {loading ? (
          <div className="flex flex-col gap-3 p-5">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : products.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-muted-foreground">
            No hay productos todavía.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16"></TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Precio</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Activo</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p, i) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon-sm" disabled={i === 0} onClick={() => move(i, -1)}>
                        <ArrowUp className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={i === products.length - 1}
                        onClick={() => move(i, 1)}
                      >
                        <ArrowDown className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{p.name}</div>
                    <div className="max-w-80 truncate text-xs text-muted-foreground">
                      {[p.linea, p.description].filter(Boolean).join(" — ")}
                    </div>
                  </TableCell>
                  <TableCell className="tnum text-sm">S/ {p.price}</TableCell>
                  <TableCell>
                    <EstadoStock stock={p.stock} />
                  </TableCell>
                  <TableCell>
                    <Switch checked={p.active} onCheckedChange={() => toggleActive(p)} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        setEditing(p)
                        setDialogOpen(true)
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <ProductFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        product={editing}
        nextSortOrder={products.length ? Math.max(...products.map((p) => p.sort_order)) + 10 : 0}
        onSaved={load}
      />
    </div>
  )
}
