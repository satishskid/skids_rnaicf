import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import { signIn as apiSignIn, signUp as apiSignUp } from './api'

interface AuthUser {
  id: string
  name: string
  email: string
  role?: string
}

interface AuthContextValue {
  user: AuthUser | null
  isLoading: boolean
  isAuthenticated: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (name: string, email: string, password: string) => Promise<void>
  signOut: () => void
  error: string | null
  clearError: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const storedUser = localStorage.getItem('auth_user')
    const storedToken = localStorage.getItem('auth_token')
    if (storedUser && storedToken) {
      try {
        setUser(JSON.parse(storedUser))
      } catch {
        localStorage.removeItem('auth_user')
        localStorage.removeItem('auth_token')
      }
    }
    setIsLoading(false)
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null)
    setIsLoading(true)
    try {
      const result = await apiSignIn(email, password)
      const u = result.user as Record<string, unknown> | undefined
      const authUser: AuthUser = {
        id: (u?.id as string) ?? '',
        name: (u?.name as string) ?? email.split('@')[0],
        email: (u?.email as string) ?? email,
        role: (u?.role as string) ?? 'nurse',
      }
      if (result.token) {
        localStorage.setItem('auth_token', result.token)
      }
      localStorage.setItem('auth_user', JSON.stringify(authUser))
      setUser(authUser)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Sign in failed'
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const signUp = useCallback(
    async (name: string, email: string, password: string) => {
      setError(null)
      setIsLoading(true)
      try {
        const result = await apiSignUp(name, email, password)
        const authUser: AuthUser = {
          id: result.user?.id ?? '',
          name: result.user?.name ?? name,
          email: result.user?.email ?? email,
        }
        if (result.token) {
          localStorage.setItem('auth_token', result.token)
        }
        localStorage.setItem('auth_user', JSON.stringify(authUser))
        setUser(authUser)
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Sign up failed'
        setError(message)
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [],
  )

  const signOut = useCallback(() => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
    setUser(null)
  }, [])

  const clearError = useCallback(() => setError(null), [])

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        signIn,
        signUp,
        signOut,
        error,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
