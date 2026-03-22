import { useEffect, useRef, useState, useCallback } from 'react'
import { useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { fetchAircraft, Aircraft } from '../services/openSky'

const REFRESH_MS = 30 * 1000 // 30 seconds

// Altitude colour scale — low (red) → high (blue), from UAV pilot's risk perspective
function altitudeColor(altM: number | null): string {
  if (altM == null) return '#94a3b8'    // unknown → grey
  if (altM < 300)   return '#ef4444'    // < 300m  → red    (drone airspace)
  if (altM < 1000)  return '#f97316'    // < 1km   → orange
  if (altM < 3000)  return '#eab308'    // < 3km   → yellow
  if (altM < 6000)  return '#34d399'    // < 6km   → green
  return '#38bdf8'                      // ≥ 6km   → blue   (high cruise)
}

function planeIcon(heading: number | null, baroAltitude: number | null, onGround: boolean) {
  const deg = heading ?? 0
  const color = onGround ? '#94a3b8' : altitudeColor(baroAltitude)
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22"
      style="transform:rotate(${deg}deg);transform-origin:center;display:block;">
      <path fill="${color}" d="M21 16v-2l-8-5V3.5C13 2.67 12.33 2 11.5 2S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
    </svg>`
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  })
}

function popupContent(a: Aircraft): string {
  const alt = a.baroAltitude != null ? `${Math.round(a.baroAltitude)} m` : '—'
  const spd = a.velocity != null ? `${Math.round(a.velocity * 3.6)} km/h` : '—'
  const hdg = a.heading != null ? `${Math.round(a.heading)}°` : '—'
  const vr = a.verticalRate != null
    ? `${a.verticalRate > 0 ? '↑' : '↓'} ${Math.abs(Math.round(a.verticalRate))} m/s`
    : '—'
  return `
    <div style="font-size:12px;line-height:1.6;min-width:140px">
      <div style="font-weight:700;font-size:14px;margin-bottom:4px">${a.callsign || a.icao24}</div>
      <div>高度：${alt}</div>
      <div>速度：${spd}</div>
      <div>航向：${hdg}</div>
      <div>升降率：${vr}</div>
      <div style="color:#94a3b8;margin-top:4px">${a.country} · ${a.icao24}</div>
    </div>`
}

export default function AircraftLayer() {
  const map = useMap()
  const markersRef = useRef<L.Marker[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [rateLimited, setRateLimited] = useState(false)

  const clearMarkers = useCallback(() => {
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []
  }, [])

  const load = useCallback(async () => {
    const b = map.getBounds()
    try {
      const aircraft = await fetchAircraft({
        north: b.getNorth(),
        south: b.getSouth(),
        west: b.getWest(),
        east: b.getEast(),
      })
      setRateLimited(false)
      clearMarkers()
      markersRef.current = aircraft.map((a) =>
        L.marker([a.latitude, a.longitude], { icon: planeIcon(a.heading, a.baroAltitude, a.onGround) })
          .bindPopup(popupContent(a), { maxWidth: 200 })
          .addTo(map)
      )
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 429) setRateLimited(true)
    }
  }, [map, clearMarkers])

  useEffect(() => {
    load()
    timerRef.current = setInterval(load, REFRESH_MS)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      clearMarkers()
    }
  }, [load, clearMarkers])

  useMapEvents({
    moveend: () => { load() },
  })

  if (rateLimited) {
    return (
      <div
        style={{ position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)', zIndex: 1000 }}
        className="px-3 py-1.5 bg-dark-800/90 border border-accent-red/40 rounded-full text-xs text-slate-300 whitespace-nowrap pointer-events-none"
      >
        ⚠ 航班 API 已達請求上限，請稍後再試
      </div>
    )
  }

  return null
}
