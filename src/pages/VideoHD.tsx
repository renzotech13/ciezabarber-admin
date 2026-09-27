import VideoOptimizer from "@/components/VideoOptimizer"

export default function VideoHD() {
  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Video HD</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Prepara un video para que se vea nítido al subirlo a WhatsApp, Instagram o TikTok. Se procesa en este equipo:
          el video no se sube a ningún servidor.
        </p>
      </div>
      <VideoOptimizer />
    </div>
  )
}
