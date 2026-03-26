/**
 * BLE GATT Profile Parsers
 *
 * Parses raw BLE characteristic data per Bluetooth SIG specifications.
 * Each parser takes a DataView from a characteristic value notification
 * and returns typed medical readings.
 *
 * References:
 * - Pulse Oximeter Service: https://www.bluetooth.com/specifications/specs/pulse-oximeter-service-1-0-1/
 * - Heart Rate Service: https://www.bluetooth.com/specifications/specs/heart-rate-service-1-0/
 * - Blood Pressure Service: https://www.bluetooth.com/specifications/specs/blood-pressure-service-1-0/
 * - IEEE 11073-20601 SFLOAT: https://www.bluetooth.com/specifications/assigned-numbers/
 */

// ============================================
// BLE SERVICE & CHARACTERISTIC UUIDS
// ============================================

export const BLE_SERVICES = {
  PULSE_OXIMETER: 0x1822,
  HEART_RATE: 0x180D,
  BLOOD_PRESSURE: 0x1810,
} as const

export type BLEServiceType = keyof typeof BLE_SERVICES

export const BLE_CHARACTERISTICS: Record<BLEServiceType, number> = {
  PULSE_OXIMETER: 0x2a5e, // PLX Spot-Check Measurement
  HEART_RATE: 0x2a37,     // Heart Rate Measurement
  BLOOD_PRESSURE: 0x2a35, // Blood Pressure Measurement
}

// Human-readable labels for pairing UI
export const BLE_SERVICE_LABELS: Record<BLEServiceType, string> = {
  PULSE_OXIMETER: 'Pulse Oximeter',
  HEART_RATE: 'Heart Rate Monitor',
  BLOOD_PRESSURE: 'Blood Pressure Cuff',
}

// ============================================
// READING TYPE
// ============================================

export interface BLEReading {
  timestamp: string
  deviceName: string
  serviceType: BLEServiceType
  spo2?: number
  heartRate?: number
  pulseRate?: number
  systolic?: number
  diastolic?: number
  meanArterialPressure?: number
}

// ============================================
// IEEE 11073-20601 SFLOAT PARSER
// ============================================

/**
 * Parse an IEEE 11073-20601 SFLOAT (Short Float) value.
 * Format: 16-bit = 4-bit exponent (signed) + 12-bit mantissa (signed)
 *
 * Special values:
 * - 0x07FF = NaN
 * - 0x0800 = NRes (not at this resolution)
 * - 0x07FE = +Infinity
 * - 0x0802 = -Infinity
 * - 0x0801 = Reserved
 */
export function parseSFLOAT(raw: number): number {
  // Special values
  if (raw === 0x07ff) return NaN    // NaN
  if (raw === 0x0800) return NaN    // NRes
  if (raw === 0x07fe) return Infinity
  if (raw === 0x0802) return -Infinity
  if (raw === 0x0801) return NaN    // Reserved

  // Extract exponent (upper 4 bits, signed)
  let exponent = (raw >> 12) & 0x0f
  if (exponent >= 8) exponent -= 16 // Sign extend 4-bit to signed

  // Extract mantissa (lower 12 bits, signed)
  let mantissa = raw & 0x0fff
  if (mantissa >= 0x0800) mantissa -= 0x1000 // Sign extend 12-bit to signed

  return mantissa * Math.pow(10, exponent)
}

// ============================================
// PULSE OXIMETER PARSER
// ============================================

/**
 * Parse PLX Spot-Check Measurement (0x2A5E)
 *
 * Byte layout:
 * [0]     Flags
 *         - Bit 0: Timestamp present
 *         - Bit 1: Measurement Status present
 *         - Bit 2: Device and Sensor Status present
 *         - Bit 3: Pulse Amplitude Index present
 *         - Bit 4: Device Clock not set
 * [1-2]   SpO2 (SFLOAT, %)
 * [3-4]   Pulse Rate (SFLOAT, bpm)
 * [5+]    Optional fields based on flags
 */
export function parsePulseOximeter(dataView: DataView): Partial<BLEReading> {
  if (dataView.byteLength < 5) {
    throw new Error('PLX Spot-Check data too short: need at least 5 bytes')
  }

  const spo2Raw = dataView.getUint16(1, true) // little-endian
  const prRaw = dataView.getUint16(3, true)

  const spo2 = parseSFLOAT(spo2Raw)
  const pulseRate = parseSFLOAT(prRaw)

  return {
    spo2: isFinite(spo2) ? Math.round(spo2) : undefined,
    pulseRate: isFinite(pulseRate) ? Math.round(pulseRate) : undefined,
    heartRate: isFinite(pulseRate) ? Math.round(pulseRate) : undefined,
  }
}

// ============================================
// HEART RATE PARSER
// ============================================

/**
 * Parse Heart Rate Measurement (0x2A37)
 *
 * Byte layout:
 * [0]     Flags
 *         - Bit 0: HR Format (0 = UINT8, 1 = UINT16)
 *         - Bit 1-2: Sensor Contact Status
 *         - Bit 3: Energy Expended present
 *         - Bit 4: RR-Interval present
 * [1]     Heart Rate (UINT8) — if bit 0 = 0
 * [1-2]   Heart Rate (UINT16 LE) — if bit 0 = 1
 */
export function parseHeartRate(dataView: DataView): Partial<BLEReading> {
  if (dataView.byteLength < 2) {
    throw new Error('Heart Rate data too short: need at least 2 bytes')
  }

  const flags = dataView.getUint8(0)
  const isUint16 = (flags & 0x01) === 1

  let heartRate: number
  if (isUint16) {
    if (dataView.byteLength < 3) {
      throw new Error('Heart Rate UINT16 format but only got 2 bytes')
    }
    heartRate = dataView.getUint16(1, true)
  } else {
    heartRate = dataView.getUint8(1)
  }

  return {
    heartRate: heartRate > 0 && heartRate < 300 ? heartRate : undefined,
  }
}

// ============================================
// BLOOD PRESSURE PARSER
// ============================================

/**
 * Parse Blood Pressure Measurement (0x2A35)
 *
 * Byte layout:
 * [0]     Flags
 *         - Bit 0: Units (0 = mmHg, 1 = kPa)
 *         - Bit 1: Timestamp present
 *         - Bit 2: Pulse Rate present
 *         - Bit 3: User ID present
 *         - Bit 4: Measurement Status present
 * [1-2]   Systolic (SFLOAT)
 * [3-4]   Diastolic (SFLOAT)
 * [5-6]   Mean Arterial Pressure (SFLOAT)
 * [7+]    Optional timestamp, pulse rate, etc.
 */
export function parseBloodPressure(dataView: DataView): Partial<BLEReading> {
  if (dataView.byteLength < 7) {
    throw new Error('Blood Pressure data too short: need at least 7 bytes')
  }

  const flags = dataView.getUint8(0)
  const isKPa = (flags & 0x01) === 1
  const hasPulseRate = (flags & 0x04) !== 0
  const hasTimestamp = (flags & 0x02) !== 0

  const systolicRaw = dataView.getUint16(1, true)
  const diastolicRaw = dataView.getUint16(3, true)
  const mapRaw = dataView.getUint16(5, true)

  let systolic = parseSFLOAT(systolicRaw)
  let diastolic = parseSFLOAT(diastolicRaw)
  let map = parseSFLOAT(mapRaw)

  // Convert kPa to mmHg if needed (1 kPa = 7.50062 mmHg)
  if (isKPa) {
    systolic *= 7.50062
    diastolic *= 7.50062
    map *= 7.50062
  }

  const result: Partial<BLEReading> = {
    systolic: isFinite(systolic) ? Math.round(systolic) : undefined,
    diastolic: isFinite(diastolic) ? Math.round(diastolic) : undefined,
    meanArterialPressure: isFinite(map) ? Math.round(map) : undefined,
  }

  // Parse optional pulse rate if present
  if (hasPulseRate) {
    let offset = 7
    if (hasTimestamp) offset += 7 // Timestamp is 7 bytes (year2 + month + day + hour + min + sec)
    if (offset + 2 <= dataView.byteLength) {
      const prRaw = dataView.getUint16(offset, true)
      const pulseRate = parseSFLOAT(prRaw)
      if (isFinite(pulseRate)) {
        result.pulseRate = Math.round(pulseRate)
        result.heartRate = Math.round(pulseRate)
      }
    }
  }

  return result
}

// ============================================
// DISPATCHER
// ============================================

/** Parse BLE characteristic data based on service type */
export function parseBLEReading(
  serviceType: BLEServiceType,
  dataView: DataView
): Partial<BLEReading> {
  switch (serviceType) {
    case 'PULSE_OXIMETER':
      return parsePulseOximeter(dataView)
    case 'HEART_RATE':
      return parseHeartRate(dataView)
    case 'BLOOD_PRESSURE':
      return parseBloodPressure(dataView)
    default:
      throw new Error(`Unknown BLE service type: ${serviceType}`)
  }
}
