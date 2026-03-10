// Authentication context for SKIDS Screen V3
// Uses expo-secure-store for persistent sessions
// Calls Better Auth endpoints on the API server

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import * as SecureStore from 'expo-secure-store'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { API_BASE } from './api'

const AUTH_STORAGE_KEY = 'skids_auth_session'
const ORG_CODE_KEY = '@skids/last-org-code'

interface AuthUser {
  id: string
  name: string
  email: string
  role?: string
  image?: string | null
}

interface AuthState {
  user: AuthUser | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  loginWithPin: (pin: string, orgCode: string) => Promise<void>
  signup: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const isAuthenticated = !!user && !!token

  // Restore persisted session on mount
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const stored = await SecureStore.getItemAsync(AUTH_STORAGE_KEY)
        if (!stored) return

        const { token: savedToken, user: savedUser } = JSON.parse(stored)
        if (!savedToken || !savedUser) return

        // Verify the token is still valid
        try {
          const res = await fetch(`${API_BASE}/api/auth/get-session`, {
            headers: { Authorization: `Bearer ${savedToken}` },
          })
          if (res.ok) {
            const data = await res.json()
            const freshUser: AuthUser = {
              id: data.user?.id || savedUser.id,
              name: data.user?.name || savedUser.name,
              email: data.user?.email || savedUser.email,
              role: data.user?.role || savedUser.role,
              image: data.user?.image || savedUser.image,
            }
            setUser(freshUser)
            setToken(savedToken)
          } else {
            // Token expired — clear storage
            await SecureStore.deleteItemAsync(AUTH_STORAGE_KEY)
          }
        } catch {
          // Network error — use cached data (offline support)
          setUser(savedUser)
          setToken(savedToken)
        }
      } catch {
        // Storage read failed — proceed to login
      } finally {
        setIsLoading(false)
      }
    }

    restoreSession()
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/auth/sign-in/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(
          (errorData as Record<string, string>).message || `Login failed (${res.status})`
        )
      }

      const data = await res.json()

      // Better Auth returns { user, session } or { token, user }
      const authUser: AuthUser = {
        id: data.user?.id || data.id || '',
        name: data.user?.name || data.name || '',
        email: data.user?.email || data.email || email,
        role: data.user?.role || data.role,
        image: data.user?.image || data.image || null,
      }

      const authToken =
        data.session?.token ||
        data.token ||
        data.session?.id ||
        res.headers.get('set-auth-token') ||
        ''

      setUser(authUser)
      setToken(authToken)
      // Persist session
      await SecureStore.setItemAsync(
        AUTH_STORAGE_KEY,
        JSON.stringify({ token: authToken, user: authUser })
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  const loginWithPin = useCallback(async (pin: string, orgCode: string) => {
    setIsLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/pin-auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, orgCode }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(
          (errorData as Record<string, string>).error || `PIN login failed (${res.status})`
        )
      }

      const data = await res.json()

      const authUser: AuthUser = {
        id: data.user?.id || '',
        name: data.user?.name || '',
        email: data.user?.email || '',
        role: data.user?.role || 'nurse',
        image: null,
      }

      const authToken = data.token || ''

      setUser(authUser)
      setToken(authToken)
      await SecureStore.setItemAsync(
        AUTH_STORAGE_KEY,
        JSON.stringify({ token: authToken, user: authUser })
      )
      // Remember org code for next login
      await AsyncStorage.setItem(ORG_CODE_KEY, orgCode)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const signup = useCallback(
    async (name: string, email: string, password: string) => {
      setIsLoading(true)
      try {
        const res = await fetch(`${API_BASE}/api/auth/sign-up/email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password }),
        })

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}))
          throw new Error(
            (errorData as Record<string, string>).message || `Signup failed (${res.status})`
          )
        }

        const data = await res.json()

        const authUser: AuthUser = {
          id: data.user?.id || data.id || '',
          name: data.user?.name || data.name || name,
          email: data.user?.email || data.email || email,
          role: data.user?.role || data.role || 'nurse',
          image: data.user?.image || data.image || null,
        }

        const authToken =
          data.session?.token ||
          data.token ||
          data.session?.id ||
          res.headers.get('set-auth-token') ||
          ''

        setUser(authUser)
        setToken(authToken)
        // Persist session
        await SecureStore.setItemAsync(
          AUTH_STORAGE_KEY,
          JSON.stringify({ token: authToken, user: authUser })
        )
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  const logout = useCallback(async () => {
    setUser(null)
    setToken(null)
    await SecureStore.deleteItemAsync(AUTH_STORAGE_KEY)
  }, [])

  return (
    <AuthContext.Provider
      value={{ user, token, isLoading, isAuthenticated, login, loginWithPin, signup, logout }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
