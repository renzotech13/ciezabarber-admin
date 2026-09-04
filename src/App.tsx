import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { AuthProvider, useAuth } from "@/lib/auth"
import Login from "@/pages/Login"
import Bookings from "@/pages/Bookings"
import Productos from "@/pages/Productos"
import Servicios from "@/pages/Servicios"
import CRM from "@/pages/CRM"
import Disponibilidad from "@/pages/Disponibilidad"
import Multimedia from "@/pages/Multimedia"
import Control from "@/pages/Control"
import AppShell from "@/components/AppShell"
import AppMovilShell from "@/pages/App/Shell"
import Agenda from "@/pages/App/Agenda"
import Vender from "@/pages/App/Vender"

/**
 * Un celular (no una tablet) va directo a la app: el panel de escritorio
 * tiene sidebar fija y tablas anchas, inusable con el pulgar. 640px deja del
 * lado del panel a la tablet del local, que es donde sí se quiere.
 */
function esCelular(): boolean {
  return window.matchMedia("(max-width: 639px)").matches
}

function Gate() {
  const { session, loading, role, roleCargando } = useAuth()

  if (loading) return null
  if (!session) return <Login />
  // El rol decide qué interfaz se monta entera, así que se espera a tenerlo.
  if (roleCargando) return null

  if (esCelular()) return <Navigate to="/app" replace />

  // Un barbero solo existe en la app móvil: el panel de escritorio depende de
  // is_staff(), que para él es false — vería todo vacío.
  if (role === "barbero") return <Navigate to="/app" replace />

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to="/reservas" replace />} />
        <Route path="/productos" element={<Productos />} />
        <Route path="/servicios" element={<Servicios />} />
        <Route path="/reservas" element={<Bookings />} />
        <Route path="/disponibilidad" element={<Disponibilidad />} />
        <Route path="/conversaciones" element={<CRM />} />
        <Route path="/multimedia" element={<Multimedia />} />
        {/* Lo financiero es solo del dueño. Mientras el rol aún se consulta no
            se decide nada — si rebotáramos ya, un superadmin entrando con el
            enlace directo a /control acabaría siempre en Reservas. */}
        <Route
          path="/control"
          element={
            roleCargando ? null : role === "superadmin" ? <Control /> : <Navigate to="/reservas" replace />
          }
        />
        <Route path="*" element={<Navigate to="/reservas" replace />} />
      </Routes>
    </AppShell>
  )
}

/**
 * La app móvil, disponible también para el dueño y recepción: la misma
 * interfaz que usan los barberos, para gestionar el negocio desde el celular
 * sin depender de la tablet del local. Va fuera de AppShell (que es la
 * versión de escritorio, con sidebar fija).
 */
function GateMovil() {
  const { session, loading, role, roleCargando } = useAuth()

  if (loading || roleCargando) return null
  if (!session) return <Login />

  return (
    <AppMovilShell>
      <Routes>
        <Route index element={<Agenda />} />
        <Route path="vender" element={<Vender />} />
        <Route path="control" element={role === "superadmin" ? <Control /> : <Navigate to="/app" replace />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </AppMovilShell>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/app/*" element={<GateMovil />} />
          <Route path="*" element={<Gate />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
