import { useEffect, useRef, useState, useCallback } from 'react'
import { useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import 'leaflet.markercluster'
import { fetchAircraft, Aircraft } from '../services/openSky'
import { useStore } from '../store/useStore'

const REFRESH_MS = 30 * 1000
const MIN_ZOOM = 4       // below this → don't load
const CLUSTER_ZOOM = 8   // below this → cluster markers

// Altitude colour scale — low (red) → high (blue), from UAV pilot's risk perspective
function altitudeColor(altM: number | null): string {
  if (altM == null) return '#94a3b8'
  if (altM < 300)   return '#ef4444'
  if (altM < 1000)  return '#f97316'
  if (altM < 3000)  return '#eab308'
  if (altM < 6000)  return '#34d399'
  return '#38bdf8'
}

function planeIcon(heading: number | null, baroAltitude: number | null, onGround: boolean) {
  const deg = heading ?? 0
  const color = onGround ? '#94a3b8' : altitudeColor(baroAltitude)
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22"
      style="transform:rotate(${deg}deg);transform-origin:center;display:block;">
      <path fill="${color}" d="M21 16v-2l-8-5V3.5C13 2.67 12.33 2 11.5 2S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
    </svg>`
  return L.divIcon({ html: svg, className: '', iconSize: [22, 22], iconAnchor: [11, 11] })
}

// Country name → ISO 3166-1 alpha-2 code (OpenSky country name format)
const COUNTRY_CODE: Record<string, string> = {
  // Asia Pacific
  'Taiwan': 'TW', 'China': 'CN', 'Hong Kong': 'HK', 'Macao': 'MO',
  'Japan': 'JP', 'South Korea': 'KR', 'North Korea': 'KP', 'Mongolia': 'MN',
  'Singapore': 'SG', 'Malaysia': 'MY', 'Thailand': 'TH', 'Myanmar': 'MM',
  'Vietnam': 'VN', 'Philippines': 'PH', 'Indonesia': 'ID', 'Brunei': 'BN',
  'Cambodia': 'KH', 'Laos': 'LA', 'Timor-Leste': 'TL',
  'India': 'IN', 'Pakistan': 'PK', 'Bangladesh': 'BD', 'Sri Lanka': 'LK',
  'Nepal': 'NP', 'Bhutan': 'BT', 'Maldives': 'MV', 'Afghanistan': 'AF',
  'Australia': 'AU', 'New Zealand': 'NZ', 'Papua New Guinea': 'PG',
  'Fiji': 'FJ', 'Solomon Islands': 'SB', 'Vanuatu': 'VU', 'Samoa': 'WS',
  'Tonga': 'TO', 'Kiribati': 'KI', 'Micronesia': 'FM', 'Palau': 'PW',
  'Marshall Islands': 'MH', 'Nauru': 'NR', 'Tuvalu': 'TV',
  // Americas
  'United States': 'US', 'Canada': 'CA', 'Mexico': 'MX',
  'Guatemala': 'GT', 'Belize': 'BZ', 'Honduras': 'HN', 'El Salvador': 'SV',
  'Nicaragua': 'NI', 'Costa Rica': 'CR', 'Panama': 'PA',
  'Cuba': 'CU', 'Jamaica': 'JM', 'Haiti': 'HT', 'Dominican Republic': 'DO',
  'Puerto Rico': 'PR', 'Trinidad and Tobago': 'TT', 'Barbados': 'BB',
  'Bahamas': 'BS', 'Grenada': 'GD', 'Saint Lucia': 'LC',
  'Saint Vincent and the Grenadines': 'VC', 'Antigua and Barbuda': 'AG',
  'Dominica': 'DM', 'Saint Kitts and Nevis': 'KN',
  'Colombia': 'CO', 'Venezuela': 'VE', 'Guyana': 'GY', 'Suriname': 'SR',
  'Brazil': 'BR', 'Ecuador': 'EC', 'Peru': 'PE', 'Bolivia': 'BO',
  'Chile': 'CL', 'Argentina': 'AR', 'Uruguay': 'UY', 'Paraguay': 'PY',
  // Europe
  'United Kingdom': 'GB', 'Ireland': 'IE', 'Germany': 'DE', 'France': 'FR',
  'Netherlands': 'NL', 'Belgium': 'BE', 'Luxembourg': 'LU',
  'Spain': 'ES', 'Portugal': 'PT', 'Italy': 'IT', 'Switzerland': 'CH',
  'Austria': 'AT', 'Liechtenstein': 'LI', 'Monaco': 'MC', 'Andorra': 'AD',
  'Sweden': 'SE', 'Norway': 'NO', 'Denmark': 'DK', 'Finland': 'FI',
  'Iceland': 'IS', 'Estonia': 'EE', 'Latvia': 'LV', 'Lithuania': 'LT',
  'Poland': 'PL', 'Czech Republic': 'CZ', 'Slovakia': 'SK', 'Hungary': 'HU',
  'Romania': 'RO', 'Bulgaria': 'BG', 'Greece': 'GR', 'Cyprus': 'CY',
  'Malta': 'MT', 'Slovenia': 'SI', 'Croatia': 'HR', 'Bosnia and Herzegovina': 'BA',
  'Serbia': 'RS', 'Montenegro': 'ME', 'North Macedonia': 'MK', 'Albania': 'AL',
  'Kosovo': 'XK', 'Moldova': 'MD', 'Ukraine': 'UA', 'Belarus': 'BY',
  'Russia': 'RU', 'Turkey': 'TR', 'Georgia': 'GE', 'Armenia': 'AM',
  'Azerbaijan': 'AZ', 'San Marino': 'SM', 'Vatican City': 'VA',
  // Middle East & Central Asia
  'United Arab Emirates': 'AE', 'Qatar': 'QA', 'Saudi Arabia': 'SA',
  'Kuwait': 'KW', 'Bahrain': 'BH', 'Oman': 'OM', 'Yemen': 'YE',
  'Iraq': 'IQ', 'Iran': 'IR', 'Jordan': 'JO', 'Lebanon': 'LB',
  'Syria': 'SY', 'Israel': 'IL', 'Palestine': 'PS',
  'Kazakhstan': 'KZ', 'Uzbekistan': 'UZ', 'Turkmenistan': 'TM',
  'Tajikistan': 'TJ', 'Kyrgyzstan': 'KG',
  // Africa
  'Egypt': 'EG', 'Libya': 'LY', 'Tunisia': 'TN', 'Algeria': 'DZ', 'Morocco': 'MA',
  'Sudan': 'SD', 'South Sudan': 'SS', 'Ethiopia': 'ET', 'Eritrea': 'ER',
  'Djibouti': 'DJ', 'Somalia': 'SO', 'Kenya': 'KE', 'Uganda': 'UG',
  'Tanzania': 'TZ', 'Rwanda': 'RW', 'Burundi': 'BI',
  'Nigeria': 'NG', 'Ghana': 'GH', 'Senegal': 'SN', 'Ivory Coast': 'CI',
  'Cameroon': 'CM', 'Chad': 'TD', 'Niger': 'NE', 'Mali': 'ML',
  'Burkina Faso': 'BF', 'Guinea': 'GN', 'Sierra Leone': 'SL', 'Liberia': 'LR',
  'Togo': 'TG', 'Benin': 'BJ', 'Mauritania': 'MR', 'Gambia': 'GM',
  'Guinea-Bissau': 'GW', 'Cabo Verde': 'CV',
  'Democratic Republic of the Congo': 'CD', 'Republic of the Congo': 'CG',
  'Central African Republic': 'CF', 'Gabon': 'GA', 'Equatorial Guinea': 'GQ',
  'Angola': 'AO', 'Zambia': 'ZM', 'Zimbabwe': 'ZW', 'Mozambique': 'MZ',
  'Malawi': 'MW', 'Madagascar': 'MG', 'Comoros': 'KM',
  'South Africa': 'ZA', 'Namibia': 'NA', 'Botswana': 'BW',
  'Lesotho': 'LS', 'Eswatini': 'SZ', 'Mauritius': 'MU', 'Seychelles': 'SC',
}

function countryFlagImg(name: string): string {
  const code = COUNTRY_CODE[name]
  if (!code) return name
  return `<img src="https://flagcdn.com/20x15/${code.toLowerCase()}.png" alt="${name}" style="display:inline;vertical-align:middle;margin-right:4px"> ${name}`
}

function popupContent(a: Aircraft): string {
  const alt = a.baroAltitude != null ? `${Math.round(a.baroAltitude)} m` : '—'
  const spd = a.velocity != null ? `${Math.round(a.velocity * 3.6)} km/h` : '—'
  const hdg = a.heading != null ? `${Math.round(a.heading)}°` : '—'
  const vr = a.verticalRate != null
    ? `${a.verticalRate > 0 ? '↑' : '↓'} ${Math.abs(Math.round(a.verticalRate))} m/s`
    : '—'
  const flag = countryFlagImg(a.country)
  return `
    <div style="font-size:12px;line-height:1.6;min-width:150px">
      <div style="font-weight:700;font-size:14px;margin-bottom:2px">${a.callsign || a.icao24}</div>
      <div>高度：${alt}</div>
      <div>速度：${spd}</div>
      <div>航向：${hdg}</div>
      <div>升降率：${vr}</div>
      <div style="color:#94a3b8;margin-top:4px">${flag} · ${a.icao24}</div>
    </div>`
}

export default function AircraftLayer() {
  const map = useMap()
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [zoom, setZoom] = useState(map.getZoom())
  const [rateLimited, setRateLimited] = useState(false)
  const setOpenskyCredits = useStore((s) => s.setOpenskyCredits)
  const setOpenskyUsingToken = useStore((s) => s.setOpenskyUsingToken)

  const clearCluster = useCallback(() => {
    if (clusterRef.current) {
      map.removeLayer(clusterRef.current)
      clusterRef.current = null
    }
  }, [map])

  const load = useCallback(async () => {
    const currentZoom = map.getZoom()
    if (currentZoom < MIN_ZOOM) { clearCluster(); return }

    const b = map.getBounds()
    try {
      const { aircraft, creditsRemaining: cr, usingToken } = await fetchAircraft({
        north: b.getNorth(), south: b.getSouth(),
        west: b.getWest(), east: b.getEast(),
      })
      setRateLimited(false)
      if (cr != null) setOpenskyCredits(cr)
      setOpenskyUsingToken(usingToken)
      clearCluster()

      const useCluster = currentZoom < CLUSTER_ZOOM
      const group = useCluster
        ? (L as unknown as { markerClusterGroup: (opts?: object) => L.MarkerClusterGroup })
            .markerClusterGroup({ maxClusterRadius: 60, disableClusteringAtZoom: CLUSTER_ZOOM })
        : (L as unknown as { markerClusterGroup: (opts?: object) => L.MarkerClusterGroup })
            .markerClusterGroup({ disableClusteringAtZoom: 1 })

      aircraft.forEach((a) => {
        L.marker([a.latitude, a.longitude], { icon: planeIcon(a.heading, a.baroAltitude, a.onGround) })
          .bindPopup(popupContent(a), { maxWidth: 200 })
          .addTo(group)
      })

      group.addTo(map)
      clusterRef.current = group
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 429) setRateLimited(true)
    }
  }, [map, clearCluster])

  useEffect(() => {
    load()
    timerRef.current = setInterval(load, REFRESH_MS)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      clearCluster()
    }
  }, [load, clearCluster])

  useMapEvents({
    moveend: () => { load() },
    zoomend: () => { setZoom(map.getZoom()) },
  })

  if (zoom < MIN_ZOOM) {
    return (
      <div
        style={{ position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)', zIndex: 1000 }}
        className="px-3 py-1.5 bg-dark-800/90 border border-dark-600 rounded-full text-xs text-slate-400 whitespace-nowrap pointer-events-none"
      >
        放大地圖以顯示即時航班
      </div>
    )
  }

  if (rateLimited) {
    return (
      <div
        style={{ position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)', zIndex: 1000 }}
        className="px-3 py-1.5 bg-dark-800/90 border border-accent-red/40 rounded-full text-xs text-slate-300 whitespace-nowrap pointer-events-none"
      >
        ⚠ 航班 API 已達請求上限，請稍後再試
      </div>
    )
  }

  return null
}
