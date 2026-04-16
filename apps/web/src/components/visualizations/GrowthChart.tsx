/**
 * Growth Chart — WHO Z-score visualization for height/weight/BMI-for-age.
 * Uses Recharts ComposedChart with Z-score band areas.
 */

import { useMemo, useState } from 'react'
import {
  ComposedChart, Area, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import type { Observation } from '@skids/shared'

interface GrowthChartProps {
  observations: Observation[]
  childDob?: string
}

type Metric = 'height' | 'weight' | 'bmi'

const Z_BANDS = [
  { z: -3, label: '-3 SD', color: '#fee2e2' },
  { z: -2, label: '-2 SD', color: '#fef3c7' },
  { z: 0, label: 'Median', color: '#dcfce7' },
  { z: 2, label: '+2 SD', color: '#fef3c7' },
  { z: 3, label: '+3 SD', color: '#fee2e2' },
]

const Z_COLORS: Record<string, string> = {
  normal: '#22c55e',
  stunting: '#ef4444',
  wasting: '#f97316',
  underweight: '#eab308',
  overweight: '#f97316',
  obese: '#ef4444',
}

export function GrowthChart({ observations, childDob }: GrowthChartProps) {
  const [metric, setMetric] = useState<Metric>('height')

  const chartData = useMemo(() => {
    const moduleMap: Record<Metric, string> = { height: 'height', weight: 'weight', bmi: 'weight' }
    const relevant = observations.filter(o => o.moduleType === moduleMap[metric])

    return relevant.map(obs => {
      const features = obs.aiAnnotations?.[0]?.features as Record<string, unknown> | undefined
      if (!features) return null

      let ageMonths = 0
      if (childDob && obs.createdAt) {
        const dob = new Date(childDob)
        const obsDate = new Date(obs.createdAt)
        ageMonths = (obsDate.getFullYear() - dob.getFullYear()) * 12 + (obsDate.getMonth() - dob.getMonth())
      }

      const value = metric === 'bmi'
        ? (features.bmiValue as number)
        : (features.value as number)
      const zScore = metric === 'height'
        ? (features.heightForAgeZ as number)
        : metric === 'weight'
          ? (features.weightForAgeZ as number)
          : (features.bmiForAgeZ as number)

      if (value === undefined) return null

      return { age: ageMonths, value, zScore: zScore ?? 0 }
    }).filter(Boolean)
  }, [observations, childDob, metric])

  const metricLabel = metric === 'height' ? 'Height (cm)' : metric === 'weight' ? 'Weight (kg)' : 'BMI'

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {(['height', 'weight', 'bmi'] as Metric[]).map(m => (
          <button
            key={m}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
              metric === m ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
            }`}
            onClick={() => setMetric(m)}
          >
            {m === 'bmi' ? 'BMI' : m.charAt(0).toUpperCase() + m.slice(1)}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={chartData} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="age" label={{ value: 'Age (months)', position: 'bottom', fontSize: 10 }} tick={{ fontSize: 10 }} />
          <YAxis label={{ value: metricLabel, angle: -90, position: 'insideLeft', fontSize: 10 }} tick={{ fontSize: 10 }} />
          <Tooltip
            formatter={((value, name) => [
              `${value}`,
              name === 'value' ? metricLabel : 'Z-Score',
            ]) as unknown as (value: unknown, name: unknown) => [string, string]}
            labelFormatter={v => `Age: ${v} months`}
            contentStyle={{ fontSize: 11 }}
          />
          {Z_BANDS.map(band => (
            <ReferenceLine key={band.z} y={band.z} stroke="#d1d5db" strokeDasharray="5 5" />
          ))}
          <Scatter dataKey="value" fill="#6366f1" r={5} name={metricLabel} />
        </ComposedChart>
      </ResponsiveContainer>

      {chartData.length === 0 && (
        <p className="text-xs text-gray-400 text-center">No {metric} data available</p>
      )}
    </div>
  )
}
