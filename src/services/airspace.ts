import type { FeatureCollection, Feature, Polygon, MultiPolygon, Position } from 'geojson'

/** Shoelace formula — returns unsigned area in coordinate units (for sorting only) */
function ringArea(ring: Position[]): number {
  let area = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    area += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1])
  }
  return Math.abs(area) / 2
}

function featureArea(f: Feature): number {
  const geom = f.geometry
  if (!geom) return 0
  if (geom.type === 'Polygon') {
    return (geom as Polygon).coordinates.reduce((s, ring) => s + ringArea(ring), 0)
  }
  if (geom.type === 'MultiPolygon') {
    return (geom as MultiPolygon).coordinates.reduce(
      (s, poly) => s + poly.reduce((ps, ring) => ps + ringArea(ring), 0), 0
    )
  }
  return 0
}

// Requests route through Vite proxy (/caa-gis → https://dronegis.caa.gov.tw)
// For Netlify: public/_redirects → "/caa-gis/* https://dronegis.caa.gov.tw/:splat 200"
const CAA_GIS = '/caa-gis/server/rest/services/Hosted'

const PAGE_SIZE = 2000

/** Paginated fetch for UAV_fs layers */
async function fetchUavFsPages(
  url: string,
  outFields = '空域名稱,限制區,空域顏色,主管機關名稱',
): Promise<{ features: Feature[]; partial: boolean }> {
  const features: Feature[] = []
  let offset = 0
  let retries = 0
  const MAX_RETRIES = 3
  while (true) {
    const params = new URLSearchParams({
      where: '1=1',
      outFields,
      f: 'geojson',
      returnGeometry: 'true',
      resultOffset: String(offset),
      resultRecordCount: String(PAGE_SIZE),
    })
    try {
      const res = await fetch(`${url}?${params}`)
      if (!res.ok) return { features, partial: true }
      const data = (await res.json()) as FeatureCollection & { exceededTransferLimit?: boolean }
      features.push(...data.features)
      retries = 0
      if (data.features.length < PAGE_SIZE && !data.exceededTransferLimit) break
      offset += data.features.length
    } catch {
      if (++retries >= MAX_RETRIES) return { features, partial: true }
    }
  }
  return { features, partial: false }
}

/**
 * Fetch airport core no-fly zones from NFZ layer (airspacetype=4).
 */
async function fetchNfzAirportPages(): Promise<{ features: Feature[]; partial: boolean }> {
  const features: Feature[] = []
  let offset = 0
  let retries = 0
  const MAX_RETRIES = 3
  while (true) {
    const params = new URLSearchParams({
      where: 'airspacetype=4',
      outFields: 'name,govermentagency',
      f: 'geojson',
      returnGeometry: 'true',
      resultOffset: String(offset),
      resultRecordCount: '2000',
    })
    try {
      const res = await fetch(`${CAA_GIS}/NFZ/FeatureServer/0/query?${params}`)
      if (!res.ok) return { features, partial: true }
      const data = (await res.json()) as FeatureCollection & { exceededTransferLimit?: boolean }
      const normalised: Feature[] = data.features.map((f) => ({
        ...f,
        properties: {
          空域名稱: (f.properties?.name as string | null) ?? '機場禁飛區',
          限制區: '紅區',
          空域顏色: '紅區',
          主管機關名稱: (f.properties?.govermentagency as string | null) ?? '交通部民用航空局',
        },
      }))
      features.push(...normalised)
      retries = 0
      if (data.features.length < PAGE_SIZE && !data.exceededTransferLimit) break
      offset += data.features.length
    } catch {
      if (++retries >= MAX_RETRIES) return { features, partial: true }
    }
  }
  return { features, partial: false }
}

/**
 * Fetch commercial port restriction zones.
 */
async function fetchCommercialPortPages(): Promise<{ features: Feature[]; partial: boolean }> {
  const features: Feature[] = []
  let offset = 0
  let retries = 0
  const MAX_RETRIES = 3
  while (true) {
    const params = new URLSearchParams({
      where: '1=1',
      outFields: '*',
      f: 'geojson',
      returnGeometry: 'true',
      resultOffset: String(offset),
      resultRecordCount: '2000',
    })
    try {
      const res = await fetch(`${CAA_GIS}/Commercial_Port_fs/FeatureServer/4/query?${params}`)
      if (!res.ok) return { features, partial: true }
      const data = (await res.json()) as FeatureCollection & { exceededTransferLimit?: boolean }
      const normalised: Feature[] = data.features.map((f) => {
        const p = f.properties as Record<string, string | null> | null
        const cond = p?.條件 ?? ''
        const zone = cond === '禁止' ? '紅區' : '黃區'
        return {
          ...f,
          properties: {
            空域名稱: p?.名稱 ?? p?.name ?? '商港管制區',
            限制區: zone,
            空域顏色: zone,
            主管機關名稱: p?.['管理_及會商_機關'] ?? '交通部航港局',
            聯絡方式: p?.['管理_及會商_機關聯絡方式'] ?? null,
            空域說明: p?.說明 ?? null,
            條件: p?.條件 ?? null,
            zone_type: '商港',
          },
        }
      })
      features.push(...normalised)
      retries = 0
      if (data.features.length < PAGE_SIZE && !data.exceededTransferLimit) break
      offset += data.features.length
    } catch {
      if (++retries >= MAX_RETRIES) return { features, partial: true }
    }
  }
  return { features, partial: false }
}

export type AirspaceResult = FeatureCollection & { partial: boolean }

export async function fetchAirspaceData(): Promise<AirspaceResult> {
  const results = await Promise.allSettled([
    fetchUavFsPages(
      `${CAA_GIS}/UAV_fs/FeatureServer/3/query`,
      '空域名稱,限制區,空域顏色,主管機關名稱,會商機關名稱,空域說明,聯絡方式,罰則,條件',
    ),
    fetchNfzAirportPages(),
    fetchCommercialPortPages(),
  ])

  let partial = false
  const [combined, nfz, ports] = results.map((r) => {
    if (r.status === 'fulfilled') {
      if (r.value.partial) partial = true
      return r.value.features
    }
    partial = true
    return [] as Feature[]
  })

  const red = combined.filter((f) => (f.properties?.限制區 as string)?.includes('紅'))
  const yellow = combined.filter((f) => !(f.properties?.限制區 as string)?.includes('紅'))

  const all = [...yellow, ...red, ...nfz, ...ports]
  all.sort((a, b) => featureArea(b) - featureArea(a))

  return { type: 'FeatureCollection', features: all, partial }
}

export type ParksResult = FeatureCollection & { partial: boolean }

export async function fetchNationalParksData(): Promise<ParksResult> {
  const features: Feature[] = []
  let offset = 0
  let retries = 0
  const MAX_RETRIES = 3
  while (true) {
    const params = new URLSearchParams({
      where: '1=1',
      outFields: '*',
      f: 'geojson',
      returnGeometry: 'true',
      resultOffset: String(offset),
      resultRecordCount: '2000',
    })
    try {
      const res = await fetch(
        `${CAA_GIS}/National_Park_fs/FeatureServer/0/query?${params}`
      )
      if (!res.ok) return { type: 'FeatureCollection', features, partial: true }
      const data = (await res.json()) as FeatureCollection & { exceededTransferLimit?: boolean }
      features.push(...data.features)
      retries = 0
      if (data.features.length < PAGE_SIZE && !data.exceededTransferLimit) break
      offset += data.features.length
    } catch {
      if (++retries >= MAX_RETRIES) return { type: 'FeatureCollection', features, partial: true }
    }
  }
  return { type: 'FeatureCollection', features, partial: false }
}
