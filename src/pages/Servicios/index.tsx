import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import CategoriesPanel from "@/pages/Servicios/CategoriesPanel"
import ServicesPanel from "@/pages/Servicios/ServicesPanel"

export default function Servicios() {
  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Servicios</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Categorías y servicios que se muestran en salon.html y reserva.html.
        </p>
      </div>

      <Tabs defaultValue="servicios">
        <TabsList className="mb-6">
          <TabsTrigger value="categorias">Categorías</TabsTrigger>
          <TabsTrigger value="servicios">Servicios</TabsTrigger>
        </TabsList>
        <TabsContent value="categorias">
          <CategoriesPanel />
        </TabsContent>
        <TabsContent value="servicios">
          <ServicesPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}
