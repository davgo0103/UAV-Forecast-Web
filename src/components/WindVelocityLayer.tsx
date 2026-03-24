import { useEffect, useRef, useCallback, useState } from 'react'
import { useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet-velocity/dist/leaflet-velocity.css'
import 'leaflet-velocity'
import { fetchWindGrid, stepForZoom, WindRateLimitError, WindGridBounds } from '../services/windGrid'

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

// How long before allowing a re-fetch for the same step+area
const COOLDOWN_MS = 30 * 60 * 1000

// Returns viewport bounds expanded by 40% in each direction as a fetch buffer,
// so panning slightly doesn't immediately trigger a new API call.
function getBufferedBounds(map: L.Map): WindGridBounds {
  const b = map.getBounds()
  const latBuf = (b.getNorth() - b.getSouth()) * 0.4
  const lngBuf = (b.getEast() - b.getWest()) * 0.4
  return {
    north: Math.min(85, b.getNorth() + latBuf),
    south: Math.max(-85, b.getSouth() - latBuf),
    west: Math.max(-180, b.getWest() - lngBuf),
    east: Math.min(180, b.getEast() + lngBuf),
  }
}

export default function WindVelocityLayer() {
  const map = useMap()
  const layerRef = useRef<L.Layer | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastStepRef = useRef<number | null>(null)
  const lastFetchTimeRef = useRef<number>(0)
  const lastFetchedBoundsRef = useRef<WindGridBounds | null>(null)
  const isFetchingRef = useRef(false)
  const [rateLimitMsg, setRateLimitMsg] = useState<string | null>(null)
  const [staleMsg, setStaleMsg] = useState<string | null>(null)

  const isViewportCovered = useCallback((): boolean => {
    const fb = lastFetchedBoundsRef.current
    if (!fb || !layerRef.current) return false
    const b = map.getBounds()
    return (
      b.getNorth() <= fb.north &&
      b.getSouth() >= fb.south &&
      b.getWest() >= fb.west &&
      b.getEast() <= fb.east
    )
  }, [map])

  const fetchForZoom = useCallback(() => {
    if (isFetchingRef.current) return

    const zoom = map.getZoom()
    const step = stepForZoom(zoom)
    const now = Date.now()

    // Skip if: same resolution tier, within cooldown, and viewport already covered
    if (
      step === lastStepRef.current &&
      now - lastFetchTimeRef.current < COOLDOWN_MS &&
      isViewportCovered()
    ) return

    isFetchingRef.current = true
    lastStepRef.current = step
    lastFetchTimeRef.current = now

    const bounds = getBufferedBounds(map)

    fetchWindGrid(bounds, zoom)
      .then(data => {
        if (!data.length) return
        setRateLimitMsg(null)
        setStaleMsg(null)
        lastFetchedBoundsRef.current = bounds

        const newLayer = L.velocityLayer({ ...VELOCITY_OPTIONS, data })
        newLayer.addTo(map)

        const internal = newLayer as unknown as { _windy?: { stop: () => void } }
        if (internal._windy?.stop) map.off('dragstart', internal._windy.stop)

        if (layerRef.current) map.removeLayer(layerRef.current)
        layerRef.current = newLayer
      })
      .catch(err => {
        if (err instanceof WindRateLimitError) {
          if (err.stale) {
            const newLayer = L.velocityLayer({ ...VELOCITY_OPTIONS, data: err.stale })
            newLayer.addTo(map)
            const internal = newLayer as unknown as { _windy?: { stop: () => void } }
            if (internal._windy?.stop) map.off('dragstart', internal._windy.stop)
            if (layerRef.current) map.removeLayer(layerRef.current)
            layerRef.current = newLayer
            const hint = err.limitType === 'minutely' ? '請一分鐘後再試' : err.limitType === 'hourly' ? '請一小時後再試' : '明天重置後恢復'
            setStaleMsg(`⚠ 風場顯示快取資料（API 已達上限，${hint}）`)
          } else {
            const msg = err.limitType === 'minutely'
              ? '⚠ 風場 API 已達每分鐘上限，請稍後再試'
              : err.limitType === 'hourly'
              ? '⚠ 風場 API 已達每小時上限，請一小時後再試'
              : '⚠ 風場 API 已達每日上限，明天重置後恢復'
            setRateLimitMsg(msg)
          }
        }
        lastFetchTimeRef.current = 0
      })
      .finally(() => { isFetchingRef.current = false })
  }, [map, isViewportCovered])

  useEffect(() => {
    fetchForZoom()
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null }
    }
  }, [fetchForZoom, map])

  useMapEvents({
    zoomend: () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(fetchForZoom, 400)
    },
    moveend: () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(fetchForZoom, 600)
    },
  })

  if (rateLimitMsg) {
    return (
      <div
        style={{ position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)', zIndex: 1000 }}
        className="px-3 py-1.5 bg-dark-800/90 border border-accent-red/40 rounded-full text-xs text-slate-300 whitespace-nowrap pointer-events-none"
      >
        {rateLimitMsg}
      </div>
    )
  }

  if (staleMsg) {
    return (
      <div
        style={{ position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)', zIndex: 1000 }}
        className="px-3 py-1.5 bg-dark-800/90 border border-accent-yellow/40 rounded-full text-xs text-slate-300 whitespace-nowrap pointer-events-none"
      >
        {staleMsg}
      </div>
    )
  }

  return null
}
