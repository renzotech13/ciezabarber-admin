import { useEffect, useState, type FormEvent } from "react"
import { toast } from "sonner"
import { ArrowDown, ArrowUp, Pencil, Plus } from "lucide-react"
import { supabase } from "@/lib/supabase"
import type { Product } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { ImagePicker } from "@/components/ImagePicker"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

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
  const [description, setDescription] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  const [active, setActive] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(product?.name ?? "")
    setPrice(product ? String(product.price) : "")
    setDescription(product?.description ?? "")
    setImageUrl(product?.image_url ?? "")
    setActive(product?.active ?? true)
  }, [open, product])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    const payload = {
      name: name.trim(),
      price: Number(price),
      description: description.trim(),
      image_url: imageUrl.trim() || null,
      active,
    }

    const { error } = isEdit
      ? await supabase.from("products").update(payload).eq("id", product!.id)
      : await supabase.from("products").insert({ ...payload, sort_order: nextSortOrder })

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar producto" : "Nuevo producto"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="prod-name">Nombre</Label>
            <Input id="prod-name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="prod-price">Precio (S/)</Label>
            <Input
              id="prod-price"
              type="number"
              step="0.01"
              min="0"
              required
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="prod-desc">Descripción</Label>
            <Textarea id="prod-desc" required value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <ImagePicker
            label="Imagen (opcional)"
            value={imageUrl || null}
            onChange={(url) => setImageUrl(url ?? "")}
          />
          <div className="flex items-center gap-2">
            <Switch id="prod-active" checked={active} onCheckedChange={setActive} />
            <Label htmlFor="prod-active">Activo (visible en el sitio)</Label>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function Productos() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)

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
            El catálogo de belleza que se muestra en index.html.
          </p>
        </div>
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
                    <div className="max-w-80 truncate text-xs text-muted-foreground">{p.description}</div>
                  </TableCell>
                  <TableCell className="text-sm">S/ {p.price}</TableCell>
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
