import { useEffect, useState } from "react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import type { SiteContent } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { ImagePicker } from "@/components/ImagePicker"

type FormState = Omit<SiteContent, "id" | "updated_at">

const EMPTY: FormState = {
  logo_url: "",
  logo_header_height: 54,
  logo_footer_height: 60,
  hero_eyebrow: "",
  hero_title: "",
  hero_subtitle: "",
  hero_image_url: "",
  about_eyebrow: "",
  about_title: "",
  about_body: "",
  about_image_big: "",
  about_image_small1: "",
  about_image_small2: "",
  belleza_image_url: "",
  salon_image_url: "",
  academia_image_url: "",
  compare_before_image: "",
  compare_after_image: "",
  footer_tagline: "",
}

export default function SiteContentPanel({
  section,
}: {
  section: "logo" | "hero" | "about" | "cards" | "footer"
}) {
  const [form, setForm] = useState<FormState>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      const { data, error } = await supabase.from("site_content").select("*").eq("id", 1).single()
      if (!active) return
      if (error) {
        toast.error("No se pudo cargar el contenido del sitio.")
      } else {
        const row = data as SiteContent
        setForm({
          logo_url: row.logo_url ?? "",
          logo_header_height: row.logo_header_height,
          logo_footer_height: row.logo_footer_height,
          hero_eyebrow: row.hero_eyebrow,
          hero_title: row.hero_title,
          hero_subtitle: row.hero_subtitle,
          hero_image_url: row.hero_image_url ?? "",
          about_eyebrow: row.about_eyebrow,
          about_title: row.about_title,
          about_body: row.about_body,
          about_image_big: row.about_image_big ?? "",
          about_image_small1: row.about_image_small1 ?? "",
          about_image_small2: row.about_image_small2 ?? "",
          belleza_image_url: row.belleza_image_url ?? "",
          salon_image_url: row.salon_image_url ?? "",
          academia_image_url: row.academia_image_url ?? "",
          compare_before_image: row.compare_before_image ?? "",
          compare_after_image: row.compare_after_image ?? "",
          footer_tagline: row.footer_tagline,
        })
      }
      setLoading(false)
    }
    load()
    return () => {
      active = false
    }
  }, [])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSave() {
    setSubmitting(true)
    const payload = {
      ...form,
      logo_url: form.logo_url?.trim() || null,
      hero_image_url: form.hero_image_url?.trim() || null,
      about_image_big: form.about_image_big?.trim() || null,
      about_image_small1: form.about_image_small1?.trim() || null,
      about_image_small2: form.about_image_small2?.trim() || null,
      belleza_image_url: form.belleza_image_url?.trim() || null,
      salon_image_url: form.salon_image_url?.trim() || null,
      academia_image_url: form.academia_image_url?.trim() || null,
      compare_before_image: form.compare_before_image?.trim() || null,
      compare_after_image: form.compare_after_image?.trim() || null,
    }
    const { error } = await supabase.from("site_content").update(payload).eq("id", 1)
    setSubmitting(false)
    if (error) {
      toast.error("No se pudo guardar.")
      return
    }
    toast.success("Contenido actualizado.")
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  return (
    <div className="flex max-w-xl flex-col gap-4">
      {section === "logo" && (
        <>
          <ImagePicker
            label="Logo (aparece en el header y en el footer de todo el sitio)"
            value={form.logo_url ?? null}
            onChange={(url) => set("logo_url", url)}
          />
          <p className="text-sm text-muted-foreground">
            Si lo dejas vacío, se muestra el nombre "Cieza Barber" como texto.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="logo-header-height">Alto en el header (px)</Label>
              <Input
                id="logo-header-height"
                type="number"
                min={16}
                max={200}
                value={form.logo_header_height}
                onChange={(e) => set("logo_header_height", Number(e.target.value) || 0)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="logo-footer-height">Alto en el footer (px)</Label>
              <Input
                id="logo-footer-height"
                type="number"
                min={16}
                max={200}
                value={form.logo_footer_height}
                onChange={(e) => set("logo_footer_height", Number(e.target.value) || 0)}
              />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            El ancho se ajusta solo para no deformar el logo — solo se controla el alto.
          </p>
        </>
      )}

      {section === "hero" && (
        <>
          <div className="flex flex-col gap-2">
            <Label htmlFor="hero-eyebrow">Etiqueta superior (arriba del título, portada)</Label>
            <Input id="hero-eyebrow" value={form.hero_eyebrow} onChange={(e) => set("hero_eyebrow", e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="hero-title">Título principal (portada)</Label>
            <Textarea id="hero-title" value={form.hero_title} onChange={(e) => set("hero_title", e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="hero-subtitle">Subtítulo (debajo del título, portada)</Label>
            <Textarea id="hero-subtitle" value={form.hero_subtitle} onChange={(e) => set("hero_subtitle", e.target.value)} />
          </div>
          <ImagePicker
            label="Foto grande de la portada (debajo del título)"
            value={form.hero_image_url ?? null}
            onChange={(url) => set("hero_image_url", url)}
          />
        </>
      )}

      {section === "about" && (
        <>
          <div className="flex flex-col gap-2">
            <Label htmlFor="about-eyebrow">Etiqueta superior (sección "Sobre nosotros")</Label>
            <Input id="about-eyebrow" value={form.about_eyebrow} onChange={(e) => set("about_eyebrow", e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="about-title">Título (sección "Sobre nosotros")</Label>
            <Textarea id="about-title" value={form.about_title} onChange={(e) => set("about_title", e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="about-body">Descripción (sección "Sobre nosotros")</Label>
            <Textarea id="about-body" value={form.about_body} onChange={(e) => set("about_body", e.target.value)} />
          </div>
          <div className="flex flex-col gap-4">
            <ImagePicker
              label='Foto grande, a la izquierda ("Sobre nosotros")'
              value={form.about_image_big ?? null}
              onChange={(url) => set("about_image_big", url)}
            />
            <ImagePicker
              label='Foto pequeña de arriba, a la derecha ("Sobre nosotros")'
              value={form.about_image_small1 ?? null}
              onChange={(url) => set("about_image_small1", url)}
            />
            <ImagePicker
              label='Foto pequeña de abajo, a la derecha ("Sobre nosotros")'
              value={form.about_image_small2 ?? null}
              onChange={(url) => set("about_image_small2", url)}
            />
          </div>
        </>
      )}

      {section === "cards" && (
        <>
          <ImagePicker
            label='Imagen tarjeta "Productos"'
            value={form.belleza_image_url ?? null}
            onChange={(url) => set("belleza_image_url", url)}
          />
          <ImagePicker
            label='Imagen tarjeta "Servicios"'
            value={form.salon_image_url ?? null}
            onChange={(url) => set("salon_image_url", url)}
          />
          <p className="text-sm text-muted-foreground">
            Si dejas vacía la imagen de "Productos", se usa la foto del primer producto activo (se edita en Productos).
          </p>
        </>
      )}

      {section === "footer" && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="footer-tagline">Texto bajo el logo</Label>
          <Textarea id="footer-tagline" value={form.footer_tagline} onChange={(e) => set("footer_tagline", e.target.value)} />
        </div>
      )}

      <div>
        <Button onClick={handleSave} disabled={submitting}>
          {submitting ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </div>
  )
}
