import { TileLayer, GeoJSON } from 'react-leaflet'
import type { FeatureCollection, Feature } from 'geojson'
import type { PathOptions } from 'leaflet'
import type { AirspaceProperties } from '../data/airspace'

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
  const props = feature?.properties as AirspaceProperties | undefined
  const zone = props?.限制區 ?? props?.空域顏色 ?? ''
  const isRed = zone.includes('紅')
  return {
    color: isRed ? '#ef4444' : '#f97316',
    fillColor: isRed ? '#ef4444' : '#f97316',
    fillOpacity: isRed ? 0.18 : 0.1,
    weight: isRed ? 2 : 1.5,
    dashArray: isRed ? undefined : '5,4',
  }
}

function parkStyle(): PathOptions {
  return {
    color: '#22c55e',
    fillColor: '#22c55e',
    fillOpacity: 0.08,
    weight: 1.5,
    dashArray: '4,4',
  }
}

function onEachAirspace(feature: Feature, layer: L.Layer) {
  const props = feature.properties as AirspaceProperties | null
  if (!props) return
  const zone = props.限制區 ?? ''
  const isRed = zone.includes('紅')
  const name = props.空域名稱 ?? '未知區域'
  const authority = props.主管機關名稱 ? `<br/><span style="color:#94a3b8;font-size:11px">${props.主管機關名稱}</span>` : ''
  const badge = isRed
    ? `<span style="color:#ef4444">⛔ 紅區（禁止飛行）</span>`
    : `<span style="color:#f97316">⚠️ 黃區（限制飛行）</span>`
  ;(layer as L.Path).bindTooltip(
    `<strong>${name}</strong><br/>${badge}${authority}<br/><span style="color:#64748b;font-size:10px">資料來源：民航局</span>`,
    { sticky: true }
  )
}

function onEachPark(feature: Feature, layer: L.Layer) {
  const props = feature.properties as { 名稱?: string; NAME?: string } | null
  const name = props?.名稱 ?? props?.NAME ?? '國家公園'
  ;(layer as L.Path).bindTooltip(
    `<strong>${name}</strong><br/><span style="color:#22c55e">🌿 國家公園（禁止飛行）</span><br/><span style="color:#64748b;font-size:10px">資料來源：民航局</span>`,
    { sticky: true }
  )
}

// Needed for bindTooltip type
import L from 'leaflet'

export default function MapOverlayLayers({
  layers,
  radarUrl,
  owmKey,
  airspaceData,
  parksData,
}: Props) {
  return (
    <>
      {/* Rain radar */}
      {layers.radar && radarUrl && (
        <TileLayer
          url={radarUrl}
          opacity={0.65}
          attribution='<a href="https://www.rainviewer.com/" target="_blank">RainViewer</a>'
          zIndex={200}
        />
      )}

      {/* Cloud cover */}
      {layers.clouds && owmKey && (
        <TileLayer
          url={`https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${owmKey}`}
          opacity={0.5}
          zIndex={201}
        />
      )}

      {/* Wind layer */}
      {layers.wind && owmKey && (
        <TileLayer
          url={`https://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png?appid=${owmKey}`}
          opacity={0.65}
          zIndex={202}
        />
      )}

      {/* National parks (green) */}
      {layers.parks && parksData && (
        <GeoJSON
          key={`parks-${parksData.features.length}`}
          data={parksData}
          style={parkStyle}
          onEachFeature={onEachPark}
        />
      )}

      {/* CAA airspace restrictions (red/yellow) */}
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
