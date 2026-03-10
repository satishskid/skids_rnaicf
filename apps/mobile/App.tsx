// SKIDS Screen V3 — React Native entry point
// Full navigation with role-based tab switching

import React from 'react'
import { Text, View, ActivityIndicator } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { SafeAreaProvider } from 'react-native-safe-area-context'

// Auth
import { AuthProvider, useAuth } from './src/lib/AuthContext'

// Screens
import { LoginScreen } from './src/screens/LoginScreen'
// SignupScreen removed — admin creates accounts, nurses use PIN
import { CampaignsScreen } from './src/screens/CampaignsScreen'
import { CampaignDetailScreen } from './src/screens/CampaignDetailScreen'
import { RegisterChildScreen } from './src/screens/RegisterChildScreen'
import { ScreeningScreen } from './src/screens/ScreeningScreen'
import { ModuleScreen } from './src/screens/ModuleScreen'
import { ProfileScreen } from './src/screens/ProfileScreen'
import { ObservationListScreen } from './src/screens/ObservationListScreen'
import { DoctorReviewScreen } from './src/screens/DoctorReviewScreen'
import { BatchSummaryScreen } from './src/screens/BatchSummaryScreen'
import { QuickVitalsScreen } from './src/screens/QuickVitalsScreen'

// Types
import type { Campaign, Observation } from './src/lib/types'
import type { ModuleType } from './src/lib/types'

// ── Navigator types ────────────────────────────

type AuthStackParamList = {
  Login: undefined
}

type HomeStackParamList = {
  Campaigns: undefined
  CampaignDetail: { campaign: Campaign }
  RegisterChild: { campaignCode: string }
  Screening: { campaignCode: string }
  Module: {
    moduleType: ModuleType; campaignCode?: string; childId?: string
    childDob?: string; childGender?: 'male' | 'female'; childName?: string
    batchMode?: boolean; batchIndex?: number; batchTotal?: number; batchQueue?: string
  }
  QuickVitals: {
    childId: string; childDob: string; childGender: 'male' | 'female'
    childName: string; campaignCode: string
  }
  BatchSummary: {
    campaignCode: string; childId: string; childName: string; completedModules: string
  }
  ObservationList: { campaignCode: string; campaignName: string }
  DoctorReview: { observation: Observation }
}

type ScreeningStackParamList = {
  ScreeningTab: undefined
  Module: {
    moduleType: ModuleType; campaignCode?: string; childId?: string
    childDob?: string; childGender?: 'male' | 'female'; childName?: string
    batchMode?: boolean; batchIndex?: number; batchTotal?: number; batchQueue?: string
  }
  QuickVitals: {
    childId: string; childDob: string; childGender: 'male' | 'female'
    childName: string; campaignCode: string
  }
  BatchSummary: {
    campaignCode: string; childId: string; childName: string; completedModules: string
  }
}

// ── Navigators ─────────────────────────────────

const AuthStackNav = createNativeStackNavigator<AuthStackParamList>()
const HomeStackNav = createNativeStackNavigator<HomeStackParamList>()
const ScreeningStackNav = createNativeStackNavigator<ScreeningStackParamList>()
const Tab = createBottomTabNavigator()

// Header style shared across stacks
const stackHeaderStyle = {
  headerStyle: { backgroundColor: '#2563eb' },
  headerTintColor: '#fff',
  headerTitleStyle: { fontWeight: '600' as const },
}

// ── Tab icon (emoji-based) ─────────────────────

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Home: '\u{1F3E0}',
    Screening: '\u{1FA7A}',
    Profile: '\u{1F464}',
  }
  return (
    <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.4 }}>
      {icons[label] || '\u{2B50}'}
    </Text>
  )
}

// ── Auth Stack (Login + Signup) ────────────────

function AuthStack() {
  return (
    <AuthStackNav.Navigator screenOptions={{ headerShown: false }}>
      <AuthStackNav.Screen name="Login" component={LoginScreen} />
    </AuthStackNav.Navigator>
  )
}

// ── Home Stack (Campaigns flow) ────────────────

function HomeStack() {
  return (
    <HomeStackNav.Navigator screenOptions={stackHeaderStyle}>
      <HomeStackNav.Screen
        name="Campaigns"
        component={CampaignsScreen}
        options={{ headerShown: false }}
      />
      <HomeStackNav.Screen
        name="CampaignDetail"
        component={CampaignDetailScreen}
        options={({ route }) => ({
          title: route.params?.campaign?.name || 'Campaign',
        })}
      />
      <HomeStackNav.Screen
        name="RegisterChild"
        component={RegisterChildScreen}
        options={{ title: 'Register Child' }}
      />
      <HomeStackNav.Screen
        name="Screening"
        component={ScreeningScreen as any}
        options={{ title: 'Screening Modules' }}
      />
      <HomeStackNav.Screen
        name="Module"
        component={ModuleScreen as any}
        options={({ route }) => ({
          title: 'Module',
        })}
      />
      <HomeStackNav.Screen
        name="QuickVitals"
        component={QuickVitalsScreen as any}
        options={{ title: 'Quick Vitals' }}
      />
      <HomeStackNav.Screen
        name="ObservationList"
        component={ObservationListScreen as any}
        options={{ title: 'Observations' }}
      />
      <HomeStackNav.Screen
        name="BatchSummary"
        component={BatchSummaryScreen as any}
        options={{ title: 'Screening Complete' }}
      />
      <HomeStackNav.Screen
        name="DoctorReview"
        component={DoctorReviewScreen as any}
        options={{ title: 'Review Observation' }}
      />
    </HomeStackNav.Navigator>
  )
}

// ── Screening Stack (standalone tab for nurses) ─

function ScreeningStack() {
  return (
    <ScreeningStackNav.Navigator screenOptions={stackHeaderStyle}>
      <ScreeningStackNav.Screen
        name="ScreeningTab"
        component={ScreeningScreen}
        options={{ headerShown: false }}
      />
      <ScreeningStackNav.Screen
        name="Module"
        component={ModuleScreen as any}
        options={{ title: 'Module' }}
      />
      <ScreeningStackNav.Screen
        name="QuickVitals"
        component={QuickVitalsScreen as any}
        options={{ title: 'Quick Vitals' }}
      />
      <ScreeningStackNav.Screen
        name="BatchSummary"
        component={BatchSummaryScreen as any}
        options={{ title: 'Screening Complete' }}
      />
    </ScreeningStackNav.Navigator>
  )
}

// ── Main Tabs ──────────────────────────────────

function MainTabs() {
  const { user } = useAuth()
  const role = user?.role || 'nurse'

  // All roles get Home and Profile
  // Nurses and doctors get Screening tab
  const showScreeningTab = ['nurse', 'doctor', 'admin', 'ops_manager'].includes(role)

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: {
          height: 60,
          paddingBottom: 8,
          paddingTop: 4,
          borderTopColor: '#e2e8f0',
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStack}
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon label="Home" focused={focused} />,
        }}
      />
      {showScreeningTab && (
        <Tab.Screen
          name="ScreeningTab"
          component={ScreeningStack}
          options={{
            title: 'Screening',
            tabBarIcon: ({ focused }) => (
              <TabIcon label="Screening" focused={focused} />
            ),
          }}
        />
      )}
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Profile" focused={focused} />
          ),
        }}
      />
    </Tab.Navigator>
  )
}

// ── Root Navigation ────────────────────────────

function RootNav() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#2563eb' }}>
        <Text style={{ fontSize: 28, fontWeight: '900', color: '#fff' }}>SKIDS</Text>
        <Text style={{ fontSize: 16, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>screen</Text>
        <ActivityIndicator color="#fff" style={{ marginTop: 20 }} />
      </View>
    )
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? <MainTabs /> : <AuthStack />}
    </NavigationContainer>
  )
}

// ── App ────────────────────────────────────────

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
