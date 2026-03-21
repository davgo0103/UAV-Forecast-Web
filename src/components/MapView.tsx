import { useEffect, useState, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
import { LatLng } from 'leaflet'
import type { FeatureCollection } from 'geojson'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { X } from 'lucide-react'
import { useStore } from '../store/useStore'
import { reverseGeocode } from '../services/geocoding'
import { fetchAirspaceData, fetchNationalParksData } from '../services/airspace'
import MapOverlayLayers, { LayerState, AirspaceInfo } from './MapOverlayLayers'
import MapLayerControl, { BaseMapKey } from './MapLayerControl'

// Fix Leaflet default icon
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const BASE_MAPS: Record<BaseMapKey, { url: string; attribution: string }> = {
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution:
      'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
  },
  terrain: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attribution:
      'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, NPS, NRCAN, GeoBase, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), and the GIS User Community',
  },
}

function ClickHandler() {
  const setLocation = useStore((s) => s.setLocation)

  useMapEvents({
    async click(e: { latlng: LatLng }) {
      const { lat, lng } = e.latlng
      const loc = await reverseGeocode(lat, lng)
      setLocation(loc)
    },
  })
  return null
}

function MapCenterUpdater() {
  const location = useStore((s) => s.location)
  const map = useMap()

  useEffect(() => {
    if (location) {
      map.setView([location.lat, location.lon], map.getZoom())
    }
  }, [location, map])

  return null
}

/** Validate OWM key using the weather API (supports CORS, returns proper status codes) */
async function validateOwmKey(key: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=25.04&lon=121.51&appid=${key}`
    )
    return res.ok
  } catch {
    return false
  }
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="flex gap-2 text-xs leading-relaxed">
      <span className="text-slate-500 w-14 flex-shrink-0">{label}</span>
      <span className="text-slate-300 break-words min-w-0">{value}</span>
    </div>
  )
}

export default function MapView() {
  const location = useStore((s) => s.location)
  const [baseMap, setBaseMap] = useState<BaseMapKey>('dark')
  const [selectedAirspace, setSelectedAirspace] = useState<AirspaceInfo | null>(null)
  const handleAirspaceClick = useCallback((info: AirspaceInfo) => {
    setSelectedAirspace(info)
  }, [])
  const [layers, setLayers] = useState<LayerState>({
    radar: false,
    clouds: false,
    wind: false,
    airspace: true,
    parks: true,
  })
  const [radarUrl, setRadarUrl] = useState<string | null>(null)
  const [airspaceData, setAirspaceData] = useState<FeatureCollection | null>(null)
  const [parksData, setParksData] = useState<FeatureCollection | null>(null)
  // null = not checked yet, true = valid, false = invalid/not activated
  const [owmValid, setOwmValid] = useState<null | boolean>(null)

  const owmKey = (import.meta as unknown as { env: Record<string, string> }).env.VITE_OWM_API_KEY ?? ''

  // Validate OWM key on mount if key is present
  useEffect(() => {
    if (!owmKey) {
      setOwmValid(false)
      return
    }
    validateOwmKey(owmKey).then(setOwmValid)
  }, [owmKey])

  // Fetch CAA airspace data when layer is enabled (only once)
  useEffect(() => {
    if (!layers.airspace || airspaceData) return
    fetchAirspaceData().then(setAirspaceData).catch(console.error)
  }, [layers.airspace, airspaceData])

  // Fetch national parks data when layer is enabled (only once)
  useEffect(() => {
    if (!layers.parks || parksData) return
    fetchNationalParksData().then(setParksData).catch(console.error)
  }, [layers.parks, parksData])

  // Fetch latest RainViewer radar tile URL when radar layer is enabled
  useEffect(() => {
    if (!layers.radar) return
    fetch('https://api.rainviewer.com/public/weather-maps.json')
      .then((r) => r.json())
      .then((data) => {
        const past: { time: number; path: string }[] = data.radar?.past ?? []
        if (!past.length) return
        const latest = past[past.length - 1]
        setRadarUrl(
          `https://tilecache.rainviewer.com${latest.path}/256/{z}/{x}/{y}/2/1_1.png`
        )
      })
      .catch(() => {})
  }, [layers.radar])

  const toggleLayer = (key: keyof LayerState) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="w-full h-full rounded-xl overflow-hidden border border-dark-600 relative">
      <MapContainer
        center={[23.6978, 120.9605]}
        zoom={8}
        className="w-full h-full"
        style={{ background: '#0f1629' }}
      >
        {/* Base tile layer — key forces remount on switch */}
        <TileLayer
          key={baseMap}
          url={BASE_MAPS[baseMap].url}
          attribution={BASE_MAPS[baseMap].attribution}
        />

        {/* Only pass owmKey when confirmed valid to prevent 401 tile errors */}
        <MapOverlayLayers
          layers={layers}
          radarUrl={radarUrl}
          owmKey={owmValid ? owmKey : ''}
          airspaceData={airspaceData}
          parksData={parksData}
          onAirspaceClick={handleAirspaceClick}
        />

        <ClickHandler />
        <MapCenterUpdater />
        {location && <Marker position={[location.lat, location.lon]} />}
      </MapContainer>

      {/* Airspace info panel */}
      {selectedAirspace && (() => {
        const p = selectedAirspace
        const isPark = p._type === 'park'
        const name = isPark ? (p.name_full ?? '國家公園') : (p.空域名稱 ?? '未知空域')
        const badge = isPark
          ? <span className="text-emerald-400 text-xs">🌿 國家公園（需申請）</span>
          : (p.限制區 ?? '').includes('紅')
            ? <span className="text-red-400 text-xs">⛔ 紅區（禁止飛行）</span>
            : p.zone_type === '商港'
              ? <span className="text-slate-400 text-xs">🚢 商港管制區</span>
              : <span className="text-orange-400 text-xs">⚠️ 黃區（限制飛行）</span>
        const regs = p.相關規定

        return (
          <div className="absolute bottom-4 left-4 z-[1001] w-72 bg-dark-800 border border-dark-600 rounded-xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-start justify-between gap-2 px-3 pt-3 pb-2">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-100 leading-snug">{name}</div>
                <div className="mt-0.5">{badge}</div>
              </div>
              <button
                onClick={() => setSelectedAirspace(null)}
                className="text-slate-600 hover:text-slate-300 transition-colors flex-shrink-0 mt-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            {(p.空域說明 || p.主管機關名稱 || p.會商機關名稱 || p.聯絡方式 || p.罰則 || regs) && (
              <div className="border-t border-dark-600 px-3 py-2 space-y-1.5">
                <InfoRow label="說明"   value={p.空域說明} />
                <InfoRow label="主管機關" value={p.主管機關名稱} />
                <InfoRow label="會商機關" value={p.會商機關名稱} />
                <InfoRow label="聯絡方式" value={p.聯絡方式} />
                <InfoRow label="罰則"   value={p.罰則} />
                {regs && (
                  <div className="flex gap-2 text-xs leading-relaxed">
                    <span className="text-slate-500 w-14 flex-shrink-0">相關規定</span>
                    <a href={regs} target="_blank" rel="noopener noreferrer"
                      className="text-accent-blue hover:underline break-all min-w-0">{regs}</a>
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="px-3 py-1.5 border-t border-dark-600 text-xs text-slate-600">
              資料來源：民航局
            </div>
          </div>
        )
      })()}

      {/* Layer control — positioned above Leaflet (z-[1001]) */}
      <div className="absolute top-3 right-3 z-[1001]">
        <MapLayerControl
          baseMap={baseMap}
          onBaseMapChange={setBaseMap}
          layers={layers}
          onLayerToggle={toggleLayer}
          owmValid={owmValid}
        />
      </div>
    </div>
  )
}
