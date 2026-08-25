import WeeklyHours from "./WeeklyHours"
import Bloqueos from "./Bloqueos"
import Recordatorios from "./Recordatorios"

export default function Disponibilidad() {
  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Disponibilidad</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Define cuándo se pueden agendar citas. El bot y la web de reservas usan exactamente estas reglas.
        </p>
      </div>

      <WeeklyHours />
      <Bloqueos />
      <Recordatorios />
    </div>
  )
}
