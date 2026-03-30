/**
 * CampaignMap — Leaflet map showing school locations with prevalence indicators.
 * Pins are color-coded by risk level: green (low), yellow (moderate), red (high).
 */

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface CampaignPin {
  code: string
  name: string
  lat: number
  lng: number
  childrenCount: number
  screenedCount: number
  highRiskCount: number
  highRiskPct: number
}

interface CampaignMapProps {
  campaigns: CampaignPin[]
  onSelectCampaign?: (code: string) => void
}

// Risk-based marker colors
function getRiskColor(highRiskPct: number): string {
  if (highRiskPct >= 20) return '#ef4444' // red
  if (highRiskPct >= 10) return '#f59e0b' // amber
  if (highRiskPct >= 5) return '#eab308'  // yellow
  return '#22c55e' // green
}

function createCircleIcon(color: string, size: number): L.DivIcon {
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${color};border:2px solid white;
      box-shadow:0 2px 6px rgba(0,0,0,0.3);
      display:flex;align-items:center;justify-content:center;
      font-size:${size > 20 ? 10 : 8}px;font-weight:700;color:white;
    "></div>`,
  })
}

export function CampaignMap({ campaigns, onSelectCampaign }: CampaignMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const leafletMap = useRef<L.Map | null>(null)

  useEffect(() => {
    if (!mapRef.current) return
    if (leafletMap.current) {
      leafletMap.current.remove()
      leafletMap.current = null
    }

    // Default to India center
    const map = L.map(mapRef.current, {
      center: [22.5, 82.0],
      zoom: 5,
      scrollWheelZoom: true,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 18,
    }).addTo(map)

    leafletMap.current = map

    // Add markers
    const validCampaigns = campaigns.filter(c => c.lat && c.lng)
    const markers: L.Marker[] = []

    for (const c of validCampaigns) {
      const color = getRiskColor(c.highRiskPct)
      const size = Math.max(18, Math.min(40, 18 + c.childrenCount / 10))
      const marker = L.marker([c.lat, c.lng], {
        icon: createCircleIcon(color, size),
      })

      marker.bindPopup(`
        <div style="min-width:180px">
          <div style="font-weight:700;font-size:13px;margin-bottom:4px">${c.name}</div>
          <div style="font-size:11px;color:#666">
            <div>Children: <b>${c.childrenCount}</b></div>
            <div>Screened: <b>${c.screenedCount}</b></div>
            <div>High Risk: <b style="color:${c.highRiskCount > 0 ? '#ef4444' : '#22c55e'}">${c.highRiskCount} (${c.highRiskPct.toFixed(1)}%)</b></div>
          </div>
        </div>
      `, { closeButton: false })

      marker.on('click', () => {
        onSelectCampaign?.(c.code)
      })

      marker.addTo(map)
      markers.push(marker)
    }

    // Fit bounds to markers
    if (markers.length > 0) {
      const group = L.featureGroup(markers)
      map.fitBounds(group.getBounds().pad(0.2))
    }

    return () => {
      map.remove()
      leafletMap.current = null
    }
  }, [campaigns, onSelectCampaign])

  if (campaigns.filter(c => c.lat && c.lng).length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-400">
        No campaigns with location data. Add lat/lng when creating campaigns.
      </div>
    )
  }

  return (
    <div
      ref={mapRef}
      className="h-80 w-full rounded-xl border border-gray-200 overflow-hidden"
      style={{ minHeight: 320 }}
    />
  )
}
