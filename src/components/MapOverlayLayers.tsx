import L from 'leaflet'
import { TileLayer, GeoJSON } from 'react-leaflet'
import type { FeatureCollection, Feature } from 'geojson'
import type { PathOptions } from 'leaflet'

export interface LayerState {
  radar: boolean
  clouds: boolean
  wind: boolean
  airspace: boolean
  parks: boolean
}

interface Props {
  layers: LayerState
  radarUrl: string | null
  owmKey: string
  airspaceData: FeatureCollection | null
  parksData: FeatureCollection | null
}

function airspaceStyle(feature?: Feature): PathOptions {
  const zone = (feature?.properties?.限制區 ?? '') as string
  if (zone.includes('紅')) {
    return { color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.2, weight: 2 }
  }
  return { color: '#f97316', fillColor: '#f97316', fillOpacity: 0.12, weight: 1.5, dashArray: '5,4' }
}

function parkStyle(): PathOptions {
  return { color: '#22c55e', fillColor: '#22c55e', fillOpacity: 0.08, weight: 1.5, dashArray: '4,4' }
}

function onEachAirspace(feature: Feature, layer: L.Layer) {
  const p = feature.properties as Record<string, string | null> | null
  if (!p) return

  const zone = p.限制區 ?? ''
  const name = p.空域名稱 ?? null
  const authority = p.主管機關名稱 ?? null
  const badge = zone.includes('紅')
    ? `<span style="color:#ef4444">⛔ 紅區（禁止飛行）</span>`
    : `<span style="color:#f97316">⚠️ 黃區（限制飛行）</span>`

  const lines = [
    name      ? `<strong style="font-size:13px">${name}</strong>` : null,
    badge,
    authority ? `<span style="color:#94a3b8;font-size:11px">📋 ${authority}</span>` : null,
    `<span style="color:#64748b;font-size:10px">資料來源：民航局</span>`,
  ].filter(Boolean).join('<br/>')

  ;(layer as L.Path).bindTooltip(lines, { sticky: true })
}

function onEachPark(feature: Feature, layer: L.Layer) {
  const p = feature.properties as Record<string, string | null> | null
  const name = p?.name_full ?? p?.名稱 ?? p?.NAME ?? '國家公園'
  const regs = p?.相關規定 ?? null

  const lines = [
    `<strong style="font-size:13px">${name}</strong>`,
    `<span style="color:#22c55e">🌿 國家公園（禁止飛行）</span>`,
    regs ? `<span style="color:#94a3b8;font-size:11px">${regs}</span>` : null,
    `<span style="color:#64748b;font-size:10px">資料來源：民航局</span>`,
  ].filter(Boolean).join('<br/>')

  ;(layer as L.Path).bindTooltip(lines, { sticky: true })
}

export default function MapOverlayLayers({
  layers, radarUrl, owmKey, airspaceData, parksData,
}: Props) {
  return (
    <>
      {layers.radar && radarUrl && (
        <TileLayer
          url={radarUrl}
          opacity={0.65}
          attribution='<a href="https://www.rainviewer.com/" target="_blank">RainViewer</a>'
          zIndex={200}
        />
      )}
      {layers.clouds && owmKey && (
        <TileLayer
          url={`https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${owmKey}`}
          opacity={0.5}
          zIndex={201}
        />
      )}
      {layers.wind && owmKey && (
        <TileLayer
          url={`https://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png?appid=${owmKey}`}
          opacity={0.65}
          zIndex={202}
        />
      )}
      {layers.parks && parksData && (
        <GeoJSON
          key={`parks-${parksData.features.length}`}
          data={parksData}
          style={parkStyle}
          onEachFeature={onEachPark}
        />
      )}
      {layers.airspace && airspaceData && (
        <GeoJSON
          key={`airspace-${airspaceData.features.length}`}
          data={airspaceData}
          style={airspaceStyle}
          onEachFeature={onEachAirspace}
        />
      )}
    </>
  )
}
