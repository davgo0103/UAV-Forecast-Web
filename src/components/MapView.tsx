import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
import { LatLng } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useStore } from '../store/useStore'
import { reverseGeocode } from '../services/geocoding'

// Fix Leaflet default icon
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

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

export default function MapView() {
  const location = useStore((s) => s.location)

  return (
    <div className="w-full h-full rounded-xl overflow-hidden border border-dark-600">
      <MapContainer
        center={[23.6978, 120.9605]}
        zoom={8}
        className="w-full h-full"
        style={{ background: '#0f1629' }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
        />
        <ClickHandler />
        <MapCenterUpdater />
        {location && (
          <Marker position={[location.lat, location.lon]} />
        )}
      </MapContainer>
    </div>
  )
}
