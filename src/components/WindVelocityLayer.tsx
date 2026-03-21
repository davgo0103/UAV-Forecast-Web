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

// Cooldown: don't re-fetch the same zoom level within 30 minutes
const COOLDOWN_MS = 30 * 60 * 1000

export default function WindVelocityLayer() {
  const map = useMap()
  const layerRef = useRef<L.Layer | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fetchedBoundsRef = useRef<L.LatLngBounds | null>(null)
  const lastFetchZoomRef = useRef<number | null>(null)
  const lastFetchTimeRef = useRef<number>(0)
  const isFetchingRef = useRef(false)
  const [rateLimited, setRateLimited] = useState(false)

  const fetchForView = useCallback((forceZoom?: number) => {
    if (isFetchingRef.current) return

    const bounds = map.getBounds()
    const zoom = forceZoom ?? map.getZoom()
    const now = Date.now()

    // Cooldown: skip if same zoom level was fetched within COOLDOWN_MS
    const sameZoomStep = stepForZoom(zoom) === stepForZoom(lastFetchZoomRef.current ?? -1)
    if (sameZoomStep && now - lastFetchTimeRef.current < COOLDOWN_MS && layerRef.current) return

    // Buffer: 4x viewport so pan rarely triggers a new fetch
    const latPad = (bounds.getNorth() - bounds.getSouth()) * 2
    const lonPad = (bounds.getEast() - bounds.getWest()) * 2

    const buffered = {
      north: Math.min(85, bounds.getNorth() + latPad),
      south: Math.max(-85, bounds.getSouth() - latPad),
      west: Math.max(-180, bounds.getWest() - lonPad),
      east: Math.min(180, bounds.getEast() + lonPad),
    }

    fetchedBoundsRef.current = L.latLngBounds(
      [buffered.south, buffered.west],
      [buffered.north, buffered.east],
    )

    isFetchingRef.current = true
    lastFetchZoomRef.current = zoom
    lastFetchTimeRef.current = now

    fetchWindGrid(buffered, zoom)
      .then(data => {
        if (!data.length) return
        setRateLimited(false)

        const newLayer = L.velocityLayer({ ...VELOCITY_OPTIONS, data })
        newLayer.addTo(map)

        // Prevent leaflet-velocity from pausing animation on drag
        const internal = newLayer as unknown as { _windy?: { stop: () => void } }
        if (internal._windy?.stop) map.off('dragstart', internal._windy.stop)

        if (layerRef.current) map.removeLayer(layerRef.current)
        layerRef.current = newLayer
      })
      .catch(err => {
        const msg: string = err?.response?.data?.reason ?? err?.message ?? ''
        if (msg.toLowerCase().includes('limit')) setRateLimited(true)
      })
      .finally(() => { isFetchingRef.current = false })
  }, [map])

  // Initial fetch on mount
  useEffect(() => {
    fetchForView()
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null }
    }
  }, [fetchForView, map])

  useMapEvents({
    moveend: () => {
      if (fetchedBoundsRef.current?.contains(map.getBounds())) return
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => fetchForView(), 600)
    },
    zoomend: () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => fetchForView(), 600)
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
