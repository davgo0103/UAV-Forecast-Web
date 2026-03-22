import { useEffect, useRef, useCallback, useState } from 'react'
import { useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet-velocity/dist/leaflet-velocity.css'
import 'leaflet-velocity'
import { fetchWindGrid, stepForZoom } from '../services/windGrid'

const VELOCITY_OPTIONS = {
  displayValues: false,
  maxVelocity: 20,
  velocityScale: 0.006,
  colorScale: ['#1e40af', '#3b82f6', '#06b6d4', '#34d399', '#fbbf24', '#ef4444'],
  particleAge: 80,
  lineWidth: 1.5,
  particleMultiplier: 1 / 200,
  frameRate: 16,
  opacity: 0.85,
}

// Re-fetch on zoom only if resolution tier changed AND cooldown passed
const COOLDOWN_MS = 30 * 60 * 1000

// Global bounds covering the whole world (leaflet-velocity handles out-of-bound areas gracefully)
const GLOBAL_BOUNDS = { north: 85, south: -85, west: -180, east: 180 }

export default function WindVelocityLayer() {
  const map = useMap()
  const layerRef = useRef<L.Layer | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastStepRef = useRef<number | null>(null)
  const lastFetchTimeRef = useRef<number>(0)
  const isFetchingRef = useRef(false)
  const [rateLimited, setRateLimited] = useState(false)

  const fetchForZoom = useCallback(() => {
    if (isFetchingRef.current) return

    const zoom = map.getZoom()
    const step = stepForZoom(zoom)
    const now = Date.now()

    // Skip if same resolution tier and still within cooldown
    if (step === lastStepRef.current && now - lastFetchTimeRef.current < COOLDOWN_MS && layerRef.current) return

    isFetchingRef.current = true
    lastStepRef.current = step
    lastFetchTimeRef.current = now

    // Always fetch global bounds — no gaps when panning anywhere
    fetchWindGrid(GLOBAL_BOUNDS, zoom)
      .then(data => {
        if (!data.length) return
        setRateLimited(false)

        const newLayer = L.velocityLayer({ ...VELOCITY_OPTIONS, data })
        newLayer.addTo(map)

        // Prevent leaflet-velocity from pausing animation on drag
        const internal = newLayer as unknown as { _windy?: { stop: () => void } }
        if (internal._windy?.stop) map.off('dragstart', internal._windy.stop)

        // Add new layer before removing old — no visual gap
        if (layerRef.current) map.removeLayer(layerRef.current)
        layerRef.current = newLayer
      })
      .catch(err => {
        const msg: string = err?.response?.data?.reason ?? err?.message ?? ''
        if (msg.toLowerCase().includes('limit')) setRateLimited(true)
        // Restore last fetch time so cooldown isn't consumed on failure
        lastFetchTimeRef.current = 0
      })
      .finally(() => { isFetchingRef.current = false })
  }, [map])

  // Initial fetch on mount
  useEffect(() => {
    fetchForZoom()
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null }
    }
  }, [fetchForZoom, map])

  // Only refetch when zoom resolution tier changes
  useMapEvents({
    zoomend: () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(fetchForZoom, 400)
    },
  })

  if (rateLimited) {
    return (
      <div
        style={{ position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)', zIndex: 1000 }}
        className="px-3 py-1.5 bg-dark-800/90 border border-accent-yellow/40 rounded-full text-xs text-slate-300 whitespace-nowrap pointer-events-none"
      >
        ⚠ 風場資料請求達上限，顯示最後一次資料（每小時重置）
      </div>
    )
  }

  return null
}
