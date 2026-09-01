import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import type { Session } from "@supabase/supabase-js"
import { supabase } from "./supabase"
import type { ProfileRole } from "./types"

type AuthState = {
  session: Session | null
  loading: boolean
  /** Rol del perfil propio. null si la consulta falla o no hay perfil — en
   *  ese caso la app se comporta como staff normal (lo financiero se oculta),
   *  nunca al revés. */
  role: ProfileRole | null
  /** true mientras el rol de esta sesión todavía se está consultando — las
   *  rutas gated esperan a que termine en vez de rebotar al superadmin que
   *  entra con un enlace directo a /control. */
  roleCargando: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<ProfileRole | null>(null)
  const [roleCargando, setRoleCargando] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id ?? null
  useEffect(() => {
    if (!userId) {
      setRole(null)
      setRoleCargando(false)
      return
    }
    let activo = true
    setRoleCargando(true)
    supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!activo) return
        setRole((data?.role as ProfileRole | undefined) ?? null)
        setRoleCargando(false)
      })
    return () => {
      activo = false
    }
  }, [userId])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error ? error.message : null }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, loading, role, roleCargando, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider")
  return ctx
}
