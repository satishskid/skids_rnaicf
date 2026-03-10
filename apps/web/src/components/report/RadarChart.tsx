/**
 * Pure SVG Radar Chart — no external dependencies.
 * Used in Parent Report for behavioral/learning developmental profiles.
 */

interface DataPoint {
  dimension: string
  value: number // 1-5 scale
}

interface Props {
  data: DataPoint[]
  size?: number
  maxValue?: number
}

export function RadarChart({ data, size = 260, maxValue = 5 }: Props) {
  const cx = size / 2
  const cy = size / 2
  const radius = (size / 2) - 40
  const levels = 5
  const angleSlice = (Math.PI * 2) / data.length

  // Generate points for each data value
  function getPoint(index: number, value: number): [number, number] {
    const angle = angleSlice * index - Math.PI / 2
    const r = (value / maxValue) * radius
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)]
  }

  // Generate polygon path for data
  const dataPath = data
    .map((d, i) => {
      const [x, y] = getPoint(i, d.value)
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
    })
    .join(' ') + ' Z'

  // Color based on average score
  const avg = data.reduce((sum, d) => sum + d.value, 0) / data.length
  const fillColor = avg >= 3.5 ? 'rgba(34, 197, 94, 0.2)' : avg >= 2.5 ? 'rgba(234, 179, 8, 0.2)' : 'rgba(239, 68, 68, 0.2)'
  const strokeColor = avg >= 3.5 ? '#22c55e' : avg >= 2.5 ? '#eab308' : '#ef4444'

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Background levels */}
      {Array.from({ length: levels }, (_, level) => {
        const r = ((level + 1) / levels) * radius
        const points = data
          .map((_, i) => {
            const angle = angleSlice * i - Math.PI / 2
            return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`
          })
          .join(' ')
        return (
          <polygon
            key={level}
            points={points}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={level === levels - 1 ? 1.5 : 0.5}
          />
        )
      })}

      {/* Axis lines */}
      {data.map((_, i) => {
        const [x, y] = getPoint(i, maxValue)
        return (
          <line
            key={`axis-${i}`}
            x1={cx}
            y1={cy}
            x2={x}
            y2={y}
            stroke="#d1d5db"
            strokeWidth={0.5}
          />
        )
      })}

      {/* Data polygon */}
      <path d={dataPath} fill={fillColor} stroke={strokeColor} strokeWidth={2} />

      {/* Data points */}
      {data.map((d, i) => {
        const [x, y] = getPoint(i, d.value)
        const dotColor = d.value >= 3.5 ? '#22c55e' : d.value >= 2.5 ? '#eab308' : '#ef4444'
        return (
          <circle
            key={`dot-${i}`}
            cx={x}
            cy={y}
            r={4}
            fill={dotColor}
            stroke="white"
            strokeWidth={2}
          />
        )
      })}

      {/* Labels */}
      {data.map((d, i) => {
        const angle = angleSlice * i - Math.PI / 2
        const labelR = radius + 20
        const x = cx + labelR * Math.cos(angle)
        const y = cy + labelR * Math.sin(angle)
        const anchor = Math.abs(x - cx) < 5 ? 'middle' : x > cx ? 'start' : 'end'
        return (
          <text
            key={`label-${i}`}
            x={x}
            y={y}
            textAnchor={anchor}
            dominantBaseline="central"
            className="text-[10px] fill-gray-600 font-medium"
          >
            {d.dimension}
          </text>
        )
      })}

      {/* Center value labels */}
      {Array.from({ length: levels }, (_, level) => {
        const val = level + 1
        const r = (val / maxValue) * radius
        return (
          <text
            key={`level-${val}`}
            x={cx + 4}
            y={cy - r - 2}
            className="text-[8px] fill-gray-400"
          >
            {val}
          </text>
        )
      })}
    </svg>
  )
}
