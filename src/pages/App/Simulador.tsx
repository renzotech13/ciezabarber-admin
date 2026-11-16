import { SimuladorCorte } from "@/components/Simulador/SimuladorCorte"

/** En el celular se simula con el cliente en la silla; el catálogo se arma desde el panel de escritorio. */
export default function SimuladorMovil() {
  return (
    <div className="grid grid-cols-1 gap-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Simulador de cortes</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Tómale una foto de frente y te digo qué cortes le favorecen según su rostro.
        </p>
      </div>
      <SimuladorCorte compacto />
    </div>
  )
}
