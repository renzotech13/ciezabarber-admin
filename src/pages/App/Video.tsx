import VideoOptimizer from "@/components/VideoOptimizer"

/**
 * El celular es donde más se usa: el video ya está en el rollo y desde acá se
 * comparte directo a WhatsApp o Instagram con el menú del teléfono.
 */
export default function Video() {
  return (
    <div className="grid grid-cols-1 gap-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Video HD</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Deja un video listo para que se vea nítido en WhatsApp o Instagram. Se procesa en tu celular.
        </p>
      </div>
      <VideoOptimizer />
    </div>
  )
}
