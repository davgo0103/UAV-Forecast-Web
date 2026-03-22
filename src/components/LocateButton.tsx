import { useState } from 'react'
import { LocateFixed, Loader2, LocateOff } from 'lucide-react'
import { useStore } from '../store/useStore'
import { reverseGeocode } from '../services/geocoding'
import { fetchElevation } from '../services/openMeteo'

type GeoState = 'idle' | 'loading' | 'denied'

export default function LocateButton() {
  const [geoState, setGeoState] = useState<GeoState>('idle')
  const { setLocation, setTerrainElevation } = useStore()

  async function handleLocate() {
    if (!navigator.geolocation) return
    setGeoState('loading')

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords

        try {
          // Reverse geocode to get place name
          const loc = await reverseGeocode(lat, lon)

          // Use Open-Meteo SRTM elevation — more reliable than GPS vertical accuracy
          const terrainElev = await fetchElevation(lat, lon)
          const roundedElev = Math.round(terrainElev)
          setTerrainElevation(roundedElev)

          setLocation({ lat, lon, name: loc.name, elevation: roundedElev })
        } catch {
          // If geocoding fails, still set location with coordinates
          setLocation({ lat, lon, name: `${lat.toFixed(4)}, ${lon.toFixed(4)}` })
        }

        setGeoState('idle')
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGeoState('denied')
          setTimeout(() => setGeoState('idle'), 3000)
        } else {
          setGeoState('idle')
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }

  if (geoState === 'denied') {
    return (
      <button
        disabled
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent-red/10 border border-accent-red/30 text-accent-red text-xs w-full"
      >
        <LocateOff className="w-4 h-4 flex-shrink-0" />
        <span>定位被拒絕，請在瀏覽器允許位置權限</span>
      </button>
    )
  }

  return (
    <button
      onClick={handleLocate}
      disabled={geoState === 'loading'}
      className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-dark-600 border border-dark-500 hover:border-accent-cyan/50 hover:text-accent-cyan text-slate-400 text-sm transition-colors w-full disabled:opacity-60"
    >
      {geoState === 'loading' ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>定位中...</span>
        </>
      ) : (
        <>
          <LocateFixed className="w-4 h-4" />
          <span>使用我的位置</span>
        </>
      )}
    </button>
  )
}
