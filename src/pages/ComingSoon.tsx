import type { LucideIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

export default function ComingSoon({
  icon: Icon,
  title,
  description,
  phase,
}: {
  icon: LucideIcon
  title: string
  description: string
  phase: string
}) {
  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <Icon className="size-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">Todavía no disponible</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Este módulo llega en la {phase} del plan del panel.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
