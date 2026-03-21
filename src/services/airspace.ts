import type { FeatureCollection, Feature } from 'geojson'

// Requests route through Vite proxy (/caa-gis → https://dronegis.caa.gov.tw)
// For Netlify: public/_redirects → "/caa-gis/* https://dronegis.caa.gov.tw/:splat 200"
const CAA_GIS = '/caa-gis/server/rest/services/Hosted'

/** Paginated fetch for UAV_fs layers (共用 schema: 空域名稱/限制區/空域顏色/主管機關名稱) */
async function fetchUavFsPages(url: string): Promise<Feature[]> {
  const features: Feature[] = []
  let offset = 0
  while (true) {
    const params = new URLSearchParams({
      where: '1=1',
      outFields: '空域名稱,限制區,空域顏色,主管機關名稱',
      f: 'geojson',
      returnGeometry: 'true',
      resultOffset: String(offset),
      resultRecordCount: '2000',
    })
    try {
      const res = await fetch(`${url}?${params}`)
      if (!res.ok) break
      const data = (await res.json()) as FeatureCollection & { exceededTransferLimit?: boolean }
      features.push(...data.features)
      if (!data.exceededTransferLimit) break
      offset += 2000
    } catch {
      break
    }
  }
  return features
}

/**
 * Fetch airport core no-fly zones from NFZ layer (airspacetype=4).
 * Covers all 17 civil airports: TPE, TSA, KHH, RMQ, TNN, HUN, TTT, etc.
 * Normalises NFZ field names → AirspaceProperties schema.
 */
async function fetchNfzAirportPages(): Promise<Feature[]> {
  const features: Feature[] = []
  let offset = 0
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
      if (!res.ok) break
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
      if (!data.exceededTransferLimit) break
      offset += 2000
    } catch {
      break
    }
  }
  return features
}

/**
 * Fetch commercial port restriction zones (安平港、基隆港 etc.)
 * from Commercial_Port_fs/FeatureServer/4.
 * Normalises to AirspaceProperties schema as yellow zones.
 */
async function fetchCommercialPortPages(): Promise<Feature[]> {
  const features: Feature[] = []
  let offset = 0
  while (true) {
    const params = new URLSearchParams({
      where: '1=1',
      outFields: '名稱,管理機關,條件',
      f: 'geojson',
      returnGeometry: 'true',
      resultOffset: String(offset),
      resultRecordCount: '2000',
    })
    try {
      const res = await fetch(`${CAA_GIS}/Commercial_Port_fs/FeatureServer/4/query?${params}`)
      if (!res.ok) break
      const data = (await res.json()) as FeatureCollection & { exceededTransferLimit?: boolean }
      const normalised: Feature[] = data.features.map((f) => ({
        ...f,
        properties: {
          空域名稱: (f.properties?.名稱 as string | null) ?? '商港管制區',
          限制區: '黃區',
          空域顏色: '黃區',
          主管機關名稱: (f.properties?.管理機關 as string | null) ?? '交通部航港局',
          條件: f.properties?.條件 as string | null,
        },
      }))
      features.push(...normalised)
      if (!data.exceededTransferLimit) break
      offset += 2000
    } catch {
      break
    }
  }
  return features
}

/**
 * Fetch Taiwan UAV airspace restrictions from CAA GIS (民航局無人機管理平台).
 *
 * Layer mapping (UAV_fs FeatureServer):
 *   Layer 1 (UAV_fs_r)  : Red zones  (禁止區, ~4620 records)
 *   Layer 2 (UAV_fs_y)  : Yellow zones (限制區, ~5800 records)
 *   Layer 3 (UAV_fs_ry) : Combined red+yellow — NOT fetched separately
 *
 * Additional sources:
 *   NFZ airspacetype=4  : Airport core no-fly zones (17 civil airports)
 *   Commercial_Port_fs/4: Commercial port restriction zones (安平港 etc.)
 */
export async function fetchAirspaceData(): Promise<FeatureCollection> {
  const results = await Promise.allSettled([
    fetchUavFsPages(`${CAA_GIS}/UAV_fs/FeatureServer/1/query`),   // red zones
    fetchUavFsPages(`${CAA_GIS}/UAV_fs/FeatureServer/2/query`),   // yellow zones
    fetchNfzAirportPages(),                                         // airport no-fly
    fetchCommercialPortPages(),                                     // commercial ports
  ])

  const [red, yellow, nfz, ports] = results.map((r) => {
    if (r.status === 'fulfilled') return r.value
    console.warn('[airspace] partial source failed:', r.reason)
    return [] as Feature[]
  })

  return {
    type: 'FeatureCollection',
    // Render order: yellow → ports → red → NFZ airports (topmost)
    features: [...yellow, ...ports, ...red, ...nfz],
  }
}

/**
 * Fetch Taiwan National Park boundaries.
 * Field: name_full (not 名稱 or NAME)
 */
export async function fetchNationalParksData(): Promise<FeatureCollection> {
  const features: Feature[] = []
  let offset = 0
  while (true) {
    const params = new URLSearchParams({
      where: '1=1',
      outFields: '*',   // fetch all fields; name_full / 相關規定 extracted in component
      f: 'geojson',
      returnGeometry: 'true',
      resultOffset: String(offset),
      resultRecordCount: '2000',
    })
    try {
      const res = await fetch(
        `${CAA_GIS}/National_Park_fs/FeatureServer/0/query?${params}`
      )
      if (!res.ok) break
      const data = (await res.json()) as FeatureCollection & { exceededTransferLimit?: boolean }
      features.push(...data.features)
      if (!data.exceededTransferLimit) break
      offset += 2000
    } catch {
      break
    }
  }
  return { type: 'FeatureCollection', features }
}
