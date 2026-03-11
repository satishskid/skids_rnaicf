// Normal reference ranges by age/gender for pediatric vitals
// Based on WHO growth standards and clinical guidelines

export function getNormalRange(moduleType: string, ageMonths: number, gender: 'male' | 'female'): string {
  const ageYears = Math.floor(ageMonths / 12)

  switch (moduleType) {
    case 'height': {
      const heightTable: Record<number, [number, number]> = { // [boy, girl]
        2: [87, 86], 3: [96, 95], 4: [103, 102], 5: [110, 109],
        6: [116, 115], 7: [122, 121], 8: [128, 127], 9: [133, 133],
        10: [138, 138], 11: [143, 144], 12: [149, 151], 13: [156, 157],
        14: [163, 160], 15: [169, 162], 16: [173, 163], 17: [175, 163],
      }
      const row = heightTable[ageYears]
      if (!row) return 'Normal varies by age'
      const median = gender === 'male' ? row[0] : row[1]
      return `Normal ~${median - 8}–${median + 8} cm (median ${median})`
    }
    case 'weight': {
      const weightTable: Record<number, [number, number]> = {
        2: [12.2, 11.5], 3: [14.3, 13.9], 4: [16.3, 16.1], 5: [18.3, 18.2],
        6: [20.5, 20.2], 7: [22.9, 22.4], 8: [25.4, 25.0], 9: [28.1, 28.2],
        10: [31.2, 32.0], 11: [35.6, 36.9], 12: [39.9, 41.5], 13: [45.3, 46.1],
        14: [50.8, 49.4], 15: [56.0, 52.1], 16: [60.8, 53.5], 17: [64.4, 54.4],
      }
      const row = weightTable[ageYears]
      if (!row) return 'Normal varies by age'
      const median = gender === 'male' ? row[0] : row[1]
      return `Normal ~${(median * 0.75).toFixed(0)}–${(median * 1.25).toFixed(0)} kg (median ${median})`
    }
    case 'spo2':
      return 'Normal: 95–100%'
    case 'hemoglobin': {
      if (ageMonths < 60) return 'Normal: 11.0–14.0 g/dL (anemia <11.0)'
      if (ageYears <= 11) return 'Normal: 11.5–15.5 g/dL (anemia <11.5)'
      return 'Normal: 12.0–16.0 g/dL (anemia <12.0)'
    }
    case 'bp': {
      const bpTable: Record<number, string> = {
        5: '~95/55', 6: '~96/57', 7: '~97/58', 8: '~99/59',
        9: '~100/60', 10: '~102/62', 11: '~104/63', 12: '~106/65',
        13: '~108/67', 14: '~110/68', 15: '~112/70', 16: '~114/70',
      }
      const norm = bpTable[ageYears]
      return norm ? `Normal ${norm} mmHg (50th %ile)` : 'Normal varies by age/height'
    }
    case 'muac':
      if (ageMonths < 60) return 'SAM <11.5 cm · MAM 11.5–12.5 · Normal >12.5'
      return 'Normal >13.5 cm for school-age'
    default:
      return ''
  }
}
