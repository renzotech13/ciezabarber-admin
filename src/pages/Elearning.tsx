import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Course } from "@/lib/types"
import CoursesPanel from "@/pages/Elearning/CoursesPanel"
import CourseSyllabusPanel from "@/pages/Elearning/CourseSyllabusPanel"
import EnrollmentsPanel from "@/pages/Elearning/EnrollmentsPanel"

export default function Elearning() {
  const [managingCourse, setManagingCourse] = useState<Course | null>(null)

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">E-learning</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cursos, temario e inscripciones de academia.html y dashboard.html.
        </p>
      </div>

      {managingCourse ? (
        <CourseSyllabusPanel course={managingCourse} onBack={() => setManagingCourse(null)} />
      ) : (
        <Tabs defaultValue="cursos">
          <TabsList className="mb-6">
            <TabsTrigger value="cursos">Cursos</TabsTrigger>
            <TabsTrigger value="inscripciones">Inscripciones</TabsTrigger>
          </TabsList>
          <TabsContent value="cursos">
            <CoursesPanel onManageSyllabus={setManagingCourse} />
          </TabsContent>
          <TabsContent value="inscripciones">
            <EnrollmentsPanel />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
