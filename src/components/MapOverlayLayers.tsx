import { useMemo } from 'react'
import { TileLayer, GeoJSON } from 'react-leaflet'
import L from 'leaflet'
import type { FeatureCollection, Feature } from 'geojson'
import type { PathOptions } from 'leaflet'
import WindVelocityLayer from './WindVelocityLayer'

export interface LayerState {
  radar: boolean
  clouds: boolean
  wind: boolean
  airspace: boolean
  parks: boolean
  hikingTrails: boolean
}

export type AirspaceInfo = Record<string, string | null> & { _type: 'airspace' | 'park' }

interface Props {
  layers: LayerState
  radarUrl: string | null
  owmKey: string
  airspaceData: FeatureCollection | null
  parksData: FeatureCollection | null
  onAirspaceClick: (info: AirspaceInfo) => void
}

function airspaceStyle(feature?: Feature): PathOptions {
  const p = feature?.properties as Record<string, string | null> | null
  if (p?.zone_type === '商港') {
    const cond = p?.條件 ?? ''
    if (cond.includes('禁止')) {
      return { color: '#6b7280', fillColor: '#6b7280', fillOpacity: 0.3, weight: 2 }
    }
    return { color: '#9ca3af', fillColor: '#9ca3af', fillOpacity: 0.15, weight: 1.5, dashArray: '5,4' }
  }
  const zone = (p?.限制區 ?? '') as string
  if (zone.includes('紅')) {
    return { color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.2, weight: 2 }
  }
  return { color: '#f97316', fillColor: '#f97316', fillOpacity: 0.12, weight: 1.5, dashArray: '5,4' }
}

function parkStyle(): PathOptions {
  return { color: '#22c55e', fillColor: '#22c55e', fillOpacity: 0.08, weight: 1.5, dashArray: '4,4' }
}

function airspaceBadgeHtml(p: Record<string, string | null>): string {
  if (p.zone_type === '商港') {
    const cond = p.條件 ?? ''
    const t = cond.includes('禁止') ? '禁止飛行區域' : cond.includes('管制') ? '管制飛行區域' : '限制飛行區域'
    return `<span style="color:#9ca3af">🚢 商港 ${t}</span>`
  }
  return (p.限制區 ?? '').includes('紅')
    ? `<span style="color:#ef4444">⛔ 紅區（禁止飛行）</span>`
    : `<span style="color:#f97316">⚠️ 黃區（限制飛行）</span>`
}

function makeOnEachAirspace(onAirspaceClick: (info: AirspaceInfo) => void) {
  return (feature: Feature, layer: L.Layer) => {
    const p = feature.properties as Record<string, string | null> | null
    if (!p) return
    const name = p.空域名稱 ?? '未知空域'
    ;(layer as L.Path).bindTooltip(
      `<strong style="font-size:12px">${name}</strong><br/>${airspaceBadgeHtml(p)}`,
      { sticky: true },
    )
    layer.on('click', () => {
      onAirspaceClick({ ...p, _type: 'airspace' } as AirspaceInfo)
    })
  }
}

function makeOnEachPark(
  onAirspaceClick: (info: AirspaceInfo) => void,
  parkRegsMap: Map<string, string>,
) {
  return (feature: Feature, layer: L.Layer) => {
    const p = feature.properties as Record<string, string | null> | null
    const name = p?.name_full ?? p?.名稱 ?? p?.NAME ?? '國家公園'
    ;(layer as L.Path).bindTooltip(
      `<strong style="font-size:12px">${name}</strong><br/><span style="color:#22c55e">🌿 國家公園（需申請）</span>`,
      { sticky: true },
    )
    layer.on('click', () => {
      const regs = parkRegsMap.get(name) ?? p?.['相關規'] ?? null
      onAirspaceClick({ ...(p ?? {}), name_full: name, 相關規定: regs, _type: 'park' } as AirspaceInfo)
    })
  }
}

export default function MapOverlayLayers({
  layers, radarUrl, owmKey, airspaceData, parksData, onAirspaceClick,
}: Props) {
  const parkRegsMap = useMemo(() => {
    const map = new Map<string, string>()
    if (!parksData) return map
    for (const f of parksData.features) {
      const p = f.properties as Record<string, string | null> | null
      const name = p?.name_full ?? p?.名稱 ?? p?.NAME
      const regs = p?.['相關規']
      if (name && regs) map.set(name, regs)
    }
    return map
  }, [parksData])

  return (
    <>
      {layers.radar && radarUrl && (
        <TileLayer
          key={radarUrl}
          url={radarUrl}
          opacity={0.65}
          attribution='<a href="https://www.rainviewer.com/" target="_blank">RainViewer</a>'
          zIndex={200}
          maxNativeZoom={7}
        />
      )}
      {layers.clouds && owmKey && (
        <TileLayer
          url={`https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${owmKey}`}
          opacity={0.5}
          zIndex={201}
          maxNativeZoom={18}
        />
      )}
      {layers.wind && (
        <WindVelocityLayer />
      )}
      {layers.parks && parksData && (
        <GeoJSON
          key={`parks-${parksData.features.length}`}
          data={parksData}
          style={parkStyle}
          onEachFeature={makeOnEachPark(onAirspaceClick, parkRegsMap)}
        />
      )}
      {layers.airspace && airspaceData && (
        <GeoJSON
          key={`airspace-${airspaceData.features.length}`}
          data={airspaceData}
          style={airspaceStyle}
          onEachFeature={makeOnEachAirspace(onAirspaceClick)}
        />
      )}
      {layers.hikingTrails && (
        <TileLayer
          url="https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png"
          opacity={0.8}
          attribution='&copy; <a href="https://hiking.waymarkedtrails.org" target="_blank">Waymarked Trails</a>'
          zIndex={210}
          maxNativeZoom={19}
        />
      )}
    </>
  )
}
