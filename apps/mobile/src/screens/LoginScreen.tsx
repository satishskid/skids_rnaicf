// Login screen — PIN-first authentication with email fallback
// PIN pad for field workers, collapsible email form for admins

import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  Animated,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { colors, spacing, borderRadius, fontSize, fontWeight, shadow } from '../theme'
import { useAuth } from '../lib/AuthContext'

const ORG_CODE_KEY = '@skids/last-org-code'

const PIN_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'CLR', '0', '\u232B']
const MAX_PIN = 4

export function LoginScreen() {
  const { login, loginWithPin, isLoading } = useAuth()

  // PIN state
  const [pin, setPin] = useState('')
  const [orgCode, setOrgCode] = useState('')
  const [showEmailLogin, setShowEmailLogin] = useState(false)

  // Email state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Shake animation
  const shakeAnim = useRef(new Animated.Value(0)).current

  // Load last org code
  useEffect(() => {
    AsyncStorage.getItem(ORG_CODE_KEY).then(code => {
      if (code) setOrgCode(code)
    })
  }, [])

  const shakePin = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start()
  }

  const handleKeyPress = (key: string) => {
    if (isLoading) return
    if (key === 'CLR') {
      setPin('')
    } else if (key === '\u232B') {
      setPin(prev => prev.slice(0, -1))
    } else if (pin.length < MAX_PIN) {
      setPin(prev => prev + key)
    }
  }

  const handlePinLogin = async () => {
    if (pin.length < 4) {
      Alert.alert('PIN Too Short', 'Please enter at least 4 digits.')
      return
    }
    if (!orgCode.trim()) {
      Alert.alert('Org Code Required', 'Please enter your organization code.')
      return
    }

    try {
      await loginWithPin(pin, orgCode.trim())
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'PIN login failed'
      shakePin()
      setPin('')
      Alert.alert('Login Failed', message)
    }
  }

  const handleEmailLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing Fields', 'Please enter both email and password.')
      return
    }

    try {
      await login(email.trim().toLowerCase(), password)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed'
      Alert.alert('Login Failed', message)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Branding */}
        <View style={styles.brandSection}>
          <Image
            source={require('../../assets/skids-logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.brandSubtitle}>Pediatric Health Screening</Text>
        </View>

        {/* Org Code */}
        <View style={styles.orgCodeSection}>
          <Text style={styles.orgCodeLabel}>Organization</Text>
          <TextInput
            style={styles.orgCodeInput}
            placeholder="Enter org code (e.g. zpedi)"
            placeholderTextColor={colors.textMuted}
            value={orgCode}
            onChangeText={setOrgCode}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isLoading}
          />
        </View>

        {/* PIN Section */}
        <View style={styles.pinCard}>
          <Text style={styles.pinTitle}>Enter your PIN</Text>

          {/* PIN Dots */}
          <Animated.View style={[styles.pinDotsRow, { transform: [{ translateX: shakeAnim }] }]}>
            {Array.from({ length: MAX_PIN }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.pinDot,
                  i < pin.length && styles.pinDotFilled,
                ]}
              />
            ))}
          </Animated.View>

          {/* Keypad */}
          <View style={styles.keypad}>
            {PIN_KEYS.map((key) => (
              <TouchableOpacity
                key={key}
                style={[
                  styles.keypadButton,
                  (key === 'CLR' || key === '\u232B') && styles.keypadSpecial,
                ]}
                onPress={() => handleKeyPress(key)}
                activeOpacity={0.6}
                disabled={isLoading}
              >
                <Text style={[
                  styles.keypadText,
                  (key === 'CLR' || key === '\u232B') && styles.keypadSpecialText,
                ]}>
                  {key}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Sign In Button */}
          <TouchableOpacity
            style={[styles.signInButton, (isLoading || pin.length < 4) && styles.signInButtonDisabled]}
            onPress={handlePinLogin}
            disabled={isLoading || pin.length < 4}
            activeOpacity={0.8}
          >
            {isLoading && !showEmailLogin ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Text style={styles.signInButtonText}>Sign In with PIN</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Email Fallback */}
        <TouchableOpacity
          style={styles.emailToggle}
          onPress={() => setShowEmailLogin(!showEmailLogin)}
        >
          <Text style={styles.emailToggleText}>
            {showEmailLogin ? 'Hide email login' : 'Sign in with email instead'}
          </Text>
        </TouchableOpacity>

        {showEmailLogin && (
          <View style={styles.emailCard}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="nurse@clinic.org"
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                editable={!isLoading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Password</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  placeholder="Enter your password"
                  placeholderTextColor={colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="password"
                  editable={!isLoading}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Text style={styles.eyeText}>{showPassword ? 'Hide' : 'Show'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.emailSignInButton, isLoading && styles.signInButtonDisabled]}
              onPress={handleEmailLogin}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading && showEmailLogin ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={styles.signInButtonText}>Sign In with Email</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Version */}
        <Text style={styles.versionText}>SKIDS Screen v3.3.0</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  // Branding
  brandSection: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  logoImage: {
    width: 180,
    height: 120,
    marginBottom: spacing.xs,
  },
  brandSubtitle: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  // Org code
  orgCodeSection: {
    marginBottom: spacing.md,
  },
  orgCodeLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  orgCodeInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: fontSize.md,
    color: colors.text,
  },
  // PIN card
  pinCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadow.md,
  },
  pinTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  pinDotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: spacing.lg,
  },
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: 'transparent',
  },
  pinDotFilled: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  // Keypad
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  keypadButton: {
    width: '30%',
    aspectRatio: 2,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  keypadSpecial: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  keypadText: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  keypadSpecialText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  // Sign in
  signInButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    ...shadow.sm,
  },
  signInButtonDisabled: {
    opacity: 0.5,
  },
  signInButtonText: {
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  // Email toggle
  emailToggle: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  emailToggleText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: fontWeight.semibold,
  },
  // Email card
  emailCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadow.sm,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginBottom: spacing.xs + 2,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: fontSize.md,
    color: colors.text,
    minHeight: 52,
  },
  passwordRow: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 70,
  },
  eyeButton: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  eyeText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  emailSignInButton: {
    backgroundColor: colors.textSecondary,
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    marginTop: spacing.sm,
  },
  versionText: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginTop: spacing.lg,
  },
})
