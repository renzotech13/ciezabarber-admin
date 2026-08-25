import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import SiteContentPanel from "@/pages/Front/SiteContentPanel"
import TestimonialsPanel from "@/pages/Front/TestimonialsPanel"

export default function Front() {
  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Front</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Textos e imágenes de index.html: logo, hero, sobre nosotros, testimonios y footer.
        </p>
      </div>

      <Tabs defaultValue="logo">
        <TabsList className="mb-6">
          <TabsTrigger value="logo">Logo</TabsTrigger>
          <TabsTrigger value="hero">Hero</TabsTrigger>
          <TabsTrigger value="about">Sobre nosotros</TabsTrigger>
          <TabsTrigger value="cards">Tarjetas</TabsTrigger>
          <TabsTrigger value="compare">Antes/Después</TabsTrigger>
          <TabsTrigger value="testimonials">Testimonios</TabsTrigger>
          <TabsTrigger value="footer">Footer</TabsTrigger>
        </TabsList>
        <TabsContent value="logo">
          <SiteContentPanel section="logo" />
        </TabsContent>
        <TabsContent value="hero">
          <SiteContentPanel section="hero" />
        </TabsContent>
        <TabsContent value="about">
          <SiteContentPanel section="about" />
        </TabsContent>
        <TabsContent value="cards">
          <SiteContentPanel section="cards" />
        </TabsContent>
        <TabsContent value="compare">
          <SiteContentPanel section="compare" />
        </TabsContent>
        <TabsContent value="testimonials">
          <TestimonialsPanel />
        </TabsContent>
        <TabsContent value="footer">
          <SiteContentPanel section="footer" />
        </TabsContent>
      </Tabs>
    </div>
  )
}
