// SKIDS Screen V3 — React Native entry point

import React, { useState } from 'react'
import { StatusBar } from 'expo-status-bar'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView, FlatList } from 'react-native'

// ---- Simple Auth Context (inline to avoid import chain issues) ----

const API_BASE = 'https://skids-api.satish-9f4.workers.dev'

interface AuthUser {
  id: string
  name: string
  email: string
  role?: string
}

const AuthContext = React.createContext<{
  user: AuthUser | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
} | null>(null)

function useAuth() {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const login = async (email: string, password: string) => {
    setIsLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/auth/sign-in/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Login failed')
      setUser({
        id: data.user?.id || '',
        name: data.user?.name || '',
        email: data.user?.email || email,
        role: data.user?.role || 'nurse',
      })
      setToken(data.token || data.session?.token || '')
    } finally {
      setIsLoading(false)
    }
  }

  const logout = () => { setUser(null); setToken(null) }

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

// ---- Navigators ----

const AuthStack = createNativeStackNavigator()
const HomeStack = createNativeStackNavigator()
const Tab = createBottomTabNavigator()

// ---- Login Screen ----

function LoginScreen({ navigation }: any) {
  const { login, isLoading } = useAuth()
  const [email, setEmail] = useState('satish@skids.health')
  const [password, setPassword] = useState('Skids@2026')
  const [error, setError] = useState('')

  const handleLogin = async () => {
    setError('')
    try {
      await login(email, password)
    } catch (e: any) {
      setError(e.message || 'Login failed')
    }
  }

  return (
    <View style={s.loginContainer}>
      <View style={s.loginCard}>
        <Text style={s.loginTitle}>SKIDS Screen</Text>
        <Text style={s.loginSubtitle}>Pediatric Health Screening</Text>

        {error ? <Text style={s.error}>{error}</Text> : null}

        <Text style={s.label}>Email</Text>
        <TextInput
          style={s.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="nurse1@skids.health"
          placeholderTextColor="#94a3b8"
        />

        <Text style={s.label}>Password</Text>
        <TextInput
          style={s.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Password"
          placeholderTextColor="#94a3b8"
        />

        <TouchableOpacity style={s.button} onPress={handleLogin} disabled={isLoading}>
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.buttonText}>Sign In</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  )
}

// ---- Campaigns Screen ----

function CampaignsScreen({ navigation }: any) {
  const { user, token } = useAuth()
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  React.useEffect(() => {
    fetch(`${API_BASE}/api/campaigns`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.json())
      .then(data => {
        setCampaigns(Array.isArray(data) ? data : data.campaigns || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Welcome, {user?.name}</Text>
        <Text style={s.headerSubtitle}>{user?.role?.toUpperCase()} • {user?.email}</Text>
      </View>

      <Text style={s.sectionTitle}>Campaigns</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 40 }} />
      ) : campaigns.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyText}>No campaigns yet</Text>
          <Text style={s.emptySubtext}>Create one from the web dashboard</Text>
        </View>
      ) : (
        <FlatList
          data={campaigns}
          keyExtractor={(item) => item.id || item.code}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.card}
              onPress={() => navigation.navigate('CampaignDetail', { campaign: item })}
            >
              <Text style={s.cardTitle}>{item.name}</Text>
              <Text style={s.cardSubtitle}>
                {item.school_name} • {item.city}, {item.state}
              </Text>
              <View style={s.badge}>
                <Text style={s.badgeText}>{item.status || 'active'}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  )
}

// ---- Campaign Detail Screen ----

function CampaignDetailScreen({ route }: any) {
  const campaign = route.params?.campaign
  return (
    <ScrollView style={s.screen}>
      <View style={s.detailHeader}>
        <Text style={s.detailTitle}>{campaign?.name}</Text>
        <Text style={s.detailSubtitle}>{campaign?.school_name}</Text>
        <Text style={s.detailSubtitle}>{campaign?.city}, {campaign?.state}</Text>
      </View>
      <View style={s.card}>
        <Text style={s.cardTitle}>Campaign Code</Text>
        <Text style={s.codeText}>{campaign?.code}</Text>
      </View>
    </ScrollView>
  )
}

// ---- Profile Screen ----

function ProfileScreen() {
  const { user, logout } = useAuth()
  return (
    <View style={s.screen}>
      <View style={s.profileHeader}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{user?.name?.[0] || '?'}</Text>
        </View>
        <Text style={s.profileName}>{user?.name}</Text>
        <Text style={s.profileEmail}>{user?.email}</Text>
        <View style={s.roleBadge}>
          <Text style={s.roleBadgeText}>{user?.role?.toUpperCase()}</Text>
        </View>
      </View>
      <TouchableOpacity style={[s.button, { backgroundColor: '#dc2626', marginHorizontal: 20 }]} onPress={logout}>
        <Text style={s.buttonText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  )
}

// ---- Tab icons ----

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = { Home: '🏠', Profile: '👤' }
  return <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.4 }}>{icons[label] || '⭐'}</Text>
}

// ---- Navigation ----

function HomeStackNav() {
  return (
    <HomeStack.Navigator screenOptions={{ headerStyle: { backgroundColor: '#2563eb' }, headerTintColor: '#fff' }}>
      <HomeStack.Screen name="Campaigns" component={CampaignsScreen} options={{ headerShown: false }} />
      <HomeStack.Screen name="CampaignDetail" component={CampaignDetailScreen} options={({ route }: any) => ({ title: route.params?.campaign?.name || 'Campaign' })} />
    </HomeStack.Navigator>
  )
}

function AuthNav() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
    </AuthStack.Navigator>
  )
}

function MainTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false, tabBarActiveTintColor: '#2563eb', tabBarStyle: { height: 60, paddingBottom: 8 } }}>
      <Tab.Screen name="HomeTab" component={HomeStackNav} options={{ title: 'Home', tabBarIcon: ({ focused }) => <TabIcon label="Home" focused={focused} /> }} />
      <Tab.Screen name="ProfileTab" component={ProfileScreen} options={{ title: 'Profile', tabBarIcon: ({ focused }) => <TabIcon label="Profile" focused={focused} /> }} />
    </Tab.Navigator>
  )
}

function RootNav() {
  const { isAuthenticated } = useAuth()
  return (
    <NavigationContainer>
      {isAuthenticated ? <MainTabs /> : <AuthNav />}
    </NavigationContainer>
  )
}

// ---- App ----

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <RootNav />
      </AuthProvider>
    </SafeAreaProvider>
  )
}

// ---- Styles ----

const s = StyleSheet.create({
  loginContainer: { flex: 1, backgroundColor: '#2563eb', justifyContent: 'center', padding: 24 },
  loginCard: { backgroundColor: '#fff', borderRadius: 16, padding: 24 },
  loginTitle: { fontSize: 28, fontWeight: '800', color: '#0f172a', textAlign: 'center' },
  loginSubtitle: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 4, marginTop: 12 },
  input: { backgroundColor: '#f1f5f9', borderRadius: 10, padding: 14, fontSize: 16, color: '#0f172a', borderWidth: 1, borderColor: '#e2e8f0' },
  button: { backgroundColor: '#2563eb', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 20 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  error: { color: '#dc2626', textAlign: 'center', marginBottom: 8, fontSize: 13 },
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  header: { backgroundColor: '#2563eb', padding: 20, paddingTop: 50 },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '700' },
  headerSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', padding: 16, paddingBottom: 8 },
  card: { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 12, borderRadius: 12, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  cardSubtitle: { fontSize: 13, color: '#64748b', marginTop: 4 },
  badge: { backgroundColor: '#dcfce7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start', marginTop: 8 },
  badgeText: { color: '#16a34a', fontSize: 12, fontWeight: '600' },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#64748b' },
  emptySubtext: { fontSize: 14, color: '#94a3b8', marginTop: 4 },
  detailHeader: { backgroundColor: '#2563eb', padding: 20, paddingTop: 12 },
  detailTitle: { color: '#fff', fontSize: 22, fontWeight: '700' },
  detailSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 2 },
  codeText: { fontSize: 24, fontWeight: '800', color: '#2563eb', marginTop: 8, letterSpacing: 2 },
  profileHeader: { alignItems: 'center', paddingTop: 60, paddingBottom: 30 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 32, fontWeight: '700' },
  profileName: { fontSize: 22, fontWeight: '700', color: '#0f172a', marginTop: 16 },
  profileEmail: { fontSize: 14, color: '#64748b', marginTop: 4 },
  roleBadge: { backgroundColor: '#dbeafe', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 16, marginTop: 12 },
  roleBadgeText: { color: '#2563eb', fontSize: 13, fontWeight: '700' },
})
