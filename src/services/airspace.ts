import type { FeatureCollection, Feature } from 'geojson'

// Requests route through Vite proxy (/caa-gis → https://dronegis.caa.gov.tw)
// For Netlify: public/_redirects → "/caa-gis/* https://dronegis.caa.gov.tw/:splat 200"
const CAA_GIS = '/caa-gis/server/rest/services/Hosted'

/** Generic paginated fetch for UAV_fs layers (共用欄位 schema) */
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

    const res = await fetch(`${url}?${params}`)
    if (!res.ok) throw new Error(`CAA GIS HTTP ${res.status}`)

    const data = (await res.json()) as FeatureCollection & {
      exceededTransferLimit?: boolean
    }

    features.push(...data.features)
    if (!data.exceededTransferLimit) break
    offset += 2000
  }

  return features
}

/**
 * Fetch airport core no-fly zones from NFZ layer (airspacetype=4).
 * Covers all 17 civil airports including TPE, TSA, KHH, etc.
 * Normalises field names to match AirspaceProperties schema.
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

    const res = await fetch(`${CAA_GIS}/NFZ/FeatureServer/0/query?${params}`)
    if (!res.ok) throw new Error(`NFZ HTTP ${res.status}`)

    const data = (await res.json()) as FeatureCollection & {
      exceededTransferLimit?: boolean
    }

    // Normalise NFZ fields → AirspaceProperties schema
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
  }

  return features
}

/**
 * Fetch Taiwan UAV airspace restrictions from CAA GIS (民航局無人機管理平台).
 *
 * Data sources:
 * - UAV_fs/1   : Red zones (紅區, ~4620) — small airport prohibitions + other restrictions
 * - UAV_fs/3   : Yellow zones (黃區, ~5800) — surrounding restriction rings (incl. major airports)
 * - NFZ type=4 : Airport core no-fly zones — all 17 civil airports (TPE/TSA/KHH etc.)
 */
export async function fetchAirspaceData(): Promise<FeatureCollection> {
  const [redFeatures, yellowFeatures, nfzAirports] = await Promise.all([
    fetchUavFsPages(`${CAA_GIS}/UAV_fs/FeatureServer/1/query`),
    fetchUavFsPages(`${CAA_GIS}/UAV_fs/FeatureServer/3/query`),
    fetchNfzAirportPages(),
  ])

  return {
    type: 'FeatureCollection',
    // Render order: yellow → red → NFZ airports (topmost, most important)
    features: [...yellowFeatures, ...redFeatures, ...nfzAirports],
  }
}

/**
 * Fetch Taiwan National Park boundaries (which also restrict UAV flights).
 */
export async function fetchNationalParksData(): Promise<FeatureCollection> {
  const params = new URLSearchParams({
    where: '1=1',
    outFields: '名稱,NAME',
    f: 'geojson',
    returnGeometry: 'true',
    resultRecordCount: '2000',
  })

  const res = await fetch(
    `${CAA_GIS}/National_Park_fs/FeatureServer/0/query?${params}`
  )
  if (!res.ok) throw new Error(`CAA GIS National Parks HTTP ${res.status}`)
  return res.json()
}
