/**
 * BLE (Bluetooth Low Energy) Medical Device Integration
 *
 * This module provides Web Bluetooth support for standard BLE medical devices:
 * - Pulse Oximeters (SpO2 + Heart Rate)
 * - Heart Rate Monitors
 * - Blood Pressure Cuffs
 *
 * Compatible devices must implement standard Bluetooth SIG GATT profiles.
 * Proprietary devices (Welch Allyn, Masimo) are NOT supported here —
 * use the Web Share Target (/device-reading) for companion app integration.
 *
 * Platform support:
 * - ✅ Android Chrome 56+
 * - ✅ Desktop Chrome / Edge
 * - ❌ iOS (any browser) — all gated behind isSupported check
 * - ❌ Firefox — no Web Bluetooth API
 */

export {
  BLE_SERVICES,
  BLE_CHARACTERISTICS,
  BLE_SERVICE_LABELS,
  parseSFLOAT,
  parsePulseOximeter,
  parseHeartRate,
  parseBloodPressure,
  parseBLEReading,
} from './parsers'

export type {
  BLEServiceType,
  BLEReading,
} from './parsers'
