import { useEffect, useState, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
import { LatLng } from 'leaflet'
import type { FeatureCollection } from 'geojson'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { X, Loader2, RefreshCw, AlertTriangle } from 'lucide-react'
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
  hiking: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution:
      'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
  },
}

function ClickHandler() {
  const setLocation = useStore((s) => s.setLocation)

  useMapEvents({
    async click(e: { latlng: LatLng }) {
      const { lat } = e.latlng
      // Normalize longitude to [-180, 180] in case map was panned past the antimeridian
      const lng = ((e.latlng.lng % 360) + 540) % 360 - 180
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
    airspace: true,
    parks: true,
    aircraft: false,
    radar: false,
    clouds: false,
    wind: false,
    hikingTrails: false,
  })
  const [radarUrl, setRadarUrl] = useState<string | null>(null)
  const [airspaceData, setAirspaceData] = useState<FeatureCollection | null>(null)
  const [parksData, setParksData] = useState<FeatureCollection | null>(null)
  const [airspaceError, setAirspaceError] = useState(false)
  const [parksError, setParksError] = useState(false)
  const [airspacePartial, setAirspacePartial] = useState(false)
  const [parksPartial, setParksPartial] = useState(false)
  // null = not checked yet, true = valid, false = invalid/not activated
  const [owmValid, setOwmValid] = useState<null | boolean>(null)

  const owmKey = import.meta.env.VITE_OWM_API_KEY ?? ''

  // Validate OWM key on mount if key is present
  useEffect(() => {
    if (!owmKey) {
      setOwmValid(false)
      return
    }
    validateOwmKey(owmKey).then(setOwmValid)
  }, [owmKey])

  // Fetch CAA airspace data when layer is enabled (only once, retry on error)
  useEffect(() => {
    if (!layers.airspace || airspaceData) return
    setAirspaceError(false)
    setAirspacePartial(false)
    fetchAirspaceData()
      .then((result) => {
        setAirspaceData(result)
        if (result.partial) setAirspacePartial(true)
      })
      .catch(() => setAirspaceError(true))
  }, [layers.airspace, airspaceData])

  // Fetch national parks data when layer is enabled (only once, retry on error)
  useEffect(() => {
    if (!layers.parks || parksData) return
    setParksError(false)
    setParksPartial(false)
    fetchNationalParksData()
      .then((result) => {
        setParksData(result)
        if (result.partial) setParksPartial(true)
      })
      .catch(() => setParksError(true))
  }, [layers.parks, parksData])

  function retryAirspace() {
    setAirspaceError(false)
    setAirspacePartial(false)
    setAirspaceData(null)
  }

  function retryParks() {
    setParksError(false)
    setParksPartial(false)
    setParksData(null)
  }

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
          `https://tilecache.rainviewer.com${latest.path}/512/{z}/{x}/{y}/2/1_1.png`
        )
      })
      .catch((err) => { if (import.meta.env.DEV) console.warn('[MapView] radar URL fetch failed:', err) })
  }, [layers.radar])

  const toggleLayer = (key: keyof LayerState) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const isLoading = (layers.airspace && !airspaceData && !airspaceError)
    || (layers.parks && !parksData && !parksError)
  const hasError = (layers.airspace && airspaceError) || (layers.parks && parksError)
  const hasPartial = !hasError && ((layers.airspace && airspacePartial) || (layers.parks && parksPartial))

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
          maxNativeZoom={baseMap === 'hiking' ? 17 : 19}
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

      {/* Airspace loading / error indicator */}
      {(isLoading || hasError) && (
        <div className="absolute inset-0 z-[1001] flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-3 px-6 py-5 bg-dark-800/90 border border-dark-600 rounded-2xl shadow-2xl backdrop-blur-sm pointer-events-auto">
            {isLoading ? (
              <>
                <Loader2 className="w-8 h-8 animate-spin text-accent-blue" />
                <div className="text-center">
                  <div className="text-sm font-medium text-white">空域資料載入中</div>
                  <div className="text-xs text-slate-500 mt-0.5">請稍候...</div>
                </div>
              </>
            ) : (
              <>
                <AlertTriangle className="w-8 h-8 text-accent-yellow" />
                <div className="text-center">
                  <div className="text-sm font-medium text-white">空域資料載入失敗</div>
                  <div className="text-xs text-slate-500 mt-0.5">網路可能不穩定</div>
                </div>
                <div className="flex gap-2">
                  {airspaceError && (
                    <button
                      onClick={retryAirspace}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dark-600 hover:bg-dark-500 text-xs text-slate-300 transition-colors"
                    >
                      <RefreshCw className="w-3 h-3" />
                      重試管制空域
                    </button>
                  )}
                  {parksError && (
                    <button
                      onClick={retryParks}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dark-600 hover:bg-dark-500 text-xs text-slate-300 transition-colors"
                    >
                      <RefreshCw className="w-3 h-3" />
                      重試國家公園
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Partial load warning */}
      {hasPartial && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1001] flex items-center gap-2 px-3 py-1.5 bg-dark-800/90 border border-accent-yellow/40 rounded-full shadow-lg backdrop-blur-sm">
          <AlertTriangle className="w-3 h-3 text-accent-yellow flex-shrink-0" />
          <span className="text-xs text-slate-300">空域資料可能不完整</span>
          <div className="flex gap-1 ml-1">
            {airspacePartial && (
              <button onClick={retryAirspace} className="text-xs text-accent-blue hover:underline">重試空域</button>
            )}
            {airspacePartial && parksPartial && <span className="text-slate-600">·</span>}
            {parksPartial && (
              <button onClick={retryParks} className="text-xs text-accent-blue hover:underline">重試公園</button>
            )}
          </div>
        </div>
      )}

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
