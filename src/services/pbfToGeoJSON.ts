/**
 * Fetch Taiwan CAA VectorTile PBF tiles → standard GeoJSON, enriched with
 * FeatureServer attributes (空域名稱, 主管機關名稱, name_full …).
 *
 * Strategy:
 *   1. Fetch PBF tiles for Taiwan bounds → complete geometry coverage
 *   2. In parallel, fetch FeatureServer features WITH geometry + attributes
 *   3. Spatial join: for each PBF feature compute centroid → find matching
 *      FeatureServer feature by bbox containment → copy its attributes
 *   4. Return enriched GeoJSON rendered by react-leaflet's <GeoJSON> (no zoom glitch)
 */

import Pbf from 'pbf'
import { VectorTile } from 'vector-tile'
import type { FeatureCollection, Feature, Geometry, Polygon, MultiPolygon } from 'geojson'

const BASE = '/caa-gis/server/rest/services/Hosted'
const ZOOM = 8

function latLonToTile(lat: number, lon: number, z: number): [number, number] {
  const n = 2 ** z
  const x = Math.floor(((lon + 180) / 360) * n)
  const latRad = (lat * Math.PI) / 180
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  )
  return [x, y]
}

const [X_MIN, Y_MIN] = latLonToTile(25.6, 118.8, ZOOM)
const [X_MAX, Y_MAX] = latLonToTile(21.5, 122.5, ZOOM)

// ── PBF tile fetch ───────────────────────────────────────────────────────────

async function fetchPbf(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return new Uint8Array(await res.arrayBuffer())
  } catch {
    return null
  }
}

async function fetchTileFeatures(service: string, targetLayers: string[]): Promise<Feature[]> {
  const all: Feature[] = []
  const tasks: Promise<void>[] = []
  for (let x = X_MIN; x <= X_MAX; x++) {
    for (let y = Y_MIN; y <= Y_MAX; y++) {
      const url = `${BASE}/${service}/VectorTileServer/tile/${ZOOM}/${y}/${x}.pbf`
      tasks.push(
        fetchPbf(url).then((data) => {
          if (!data) return
          try {
            const tile = new VectorTile(new Pbf(data))
            for (const name of targetLayers) {
              const layer = tile.layers[name]
              if (!layer) continue
              for (let i = 0; i < layer.length; i++) {
                all.push(layer.feature(i).toGeoJSON(x, y, ZOOM))
              }
            }
          } catch { /* malformed tile */ }
        })
      )
    }
  }
  await Promise.allSettled(tasks)
  return all
}

// ── Spatial join helpers ──────────────────────────────────────────────────────

type Bbox = [number, number, number, number] // [minLon, minLat, maxLon, maxLat]

function bboxOfRing(ring: number[][]): Bbox {
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity
  for (const [lon, lat] of ring) {
    if (lon < minLon) minLon = lon
    if (lat < minLat) minLat = lat
    if (lon > maxLon) maxLon = lon
    if (lat > maxLat) maxLat = lat
  }
  return [minLon, minLat, maxLon, maxLat]
}

function bboxOfGeometry(geom: Geometry): Bbox | null {
  if (geom.type === 'Polygon') {
    return bboxOfRing(geom.coordinates[0] as number[][])
  }
  if (geom.type === 'MultiPolygon') {
    const bboxes = (geom as MultiPolygon).coordinates
      .map((poly) => bboxOfRing(poly[0] as number[][]))
    return [
      Math.min(...bboxes.map((b) => b[0])),
      Math.min(...bboxes.map((b) => b[1])),
      Math.max(...bboxes.map((b) => b[2])),
      Math.max(...bboxes.map((b) => b[3])),
    ]
  }
  return null
}

function centroidOfGeometry(geom: Geometry): [number, number] | null {
  let ring: number[][] | undefined
  if (geom.type === 'Polygon') ring = (geom as Polygon).coordinates[0] as number[][]
  else if (geom.type === 'MultiPolygon') ring = (geom as MultiPolygon).coordinates[0]?.[0] as number[][]
  if (!ring?.length) return null
  const lon = ring.reduce((s, c) => s + c[0], 0) / ring.length
  const lat = ring.reduce((s, c) => s + c[1], 0) / ring.length
  return [lon, lat]
}

function pointInBbox([lon, lat]: [number, number], [minLon, minLat, maxLon, maxLat]: Bbox): boolean {
  return lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat
}

// ── FeatureServer fetch WITH geometry (for spatial join) ─────────────────────

type FsRecord = {
  bbox: Bbox
  attrs: Record<string, string | null>
}

async function fetchFsWithGeometry(
  layerUrl: string,
  fields: string,
  extractAttrs: (p: Record<string, unknown>) => Record<string, string | null>
): Promise<FsRecord[]> {
  const records: FsRecord[] = []
  let offset = 0
  // 每次 500 筆以減少 response 大小，避免伺服器截斷回應
  const PAGE = 500
  while (true) {
    const params = new URLSearchParams({
      where: '1=1',
      outFields: fields,
      f: 'geojson',
      returnGeometry: 'true',
      geometryPrecision: '5',   // 減少座標精度，縮小 response 體積
      resultOffset: String(offset),
      resultRecordCount: String(PAGE),
    })
    try {
      const res = await fetch(`${layerUrl}?${params}`)
      if (!res.ok) break
      const data = (await res.json()) as {
        features?: Array<{ geometry: Geometry; properties: Record<string, unknown> }>
        exceededTransferLimit?: boolean
      }
      const page = data.features ?? []
      for (const feat of page) {
        if (!feat.geometry) continue
        const bbox = bboxOfGeometry(feat.geometry)
        if (!bbox) continue
        records.push({ bbox, attrs: extractAttrs(feat.properties) })
      }
      if (!data.exceededTransferLimit || page.length === 0) break
      offset += PAGE
    } catch {
      break
    }
  }
  return records
}

function spatialMatch(pbfFeature: Feature, fsRecords: FsRecord[]): Record<string, string | null> | null {
  if (!pbfFeature.geometry) return null
  const c = centroidOfGeometry(pbfFeature.geometry)
  if (!c) return null
  const match = fsRecords.find((r) => pointInBbox(c, r.bbox))
  return match?.attrs ?? null
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function fetchAirspaceVectorTile(): Promise<FeatureCollection> {
  const [features, redRecords, yellowRecords] = await Promise.all([
    fetchTileFeatures('UAV_ryg_vtpk', ['UAV_fs_ry_20260106測試機']),
    fetchFsWithGeometry(
      `${BASE}/UAV_fs/FeatureServer/1/query`,
      '空域名稱,限制區,空域顏色,主管機關名稱',
      (p) => ({
        空域名稱:    (p.空域名稱    as string | null) ?? null,
        限制區:      (p.限制區      as string | null) ?? null,
        空域顏色:    (p.空域顏色    as string | null) ?? null,
        主管機關名稱: (p.主管機關名稱 as string | null) ?? null,
      })
    ),
    fetchFsWithGeometry(
      `${BASE}/UAV_fs/FeatureServer/2/query`,
      '空域名稱,限制區,空域顏色,主管機關名稱',
      (p) => ({
        空域名稱:    (p.空域名稱    as string | null) ?? null,
        限制區:      (p.限制區      as string | null) ?? null,
        空域顏色:    (p.空域顏色    as string | null) ?? null,
        主管機關名稱: (p.主管機關名稱 as string | null) ?? null,
      })
    ),
  ])

  // Combine both FeatureServer layers into one spatial lookup list
  const fsRecords = [...redRecords, ...yellowRecords]
  console.log('[airspace] PBF features:', features.length, '| FS records for spatial join:', fsRecords.length)

  let matched = 0
  const normalized = features.map((f): Feature => {
    const p = f.properties ?? {}
    const sym = p._symbol
    const attrs = spatialMatch(f, fsRecords)
    if (attrs) matched++

    // FeatureServer 可能回傳 '紅區'/'黃區'（含「區」），統一正規化為 '紅'/'黃'
    const rawColor = attrs?.空域顏色 ?? null
    const color = rawColor != null
      ? (rawColor.includes('紅') ? '紅' : '黃')
      : (sym === 0 ? '紅' : '黃')

    const rawZone = attrs?.限制區 ?? null
    const zone = rawZone ?? (sym === 0 ? '紅區' : '黃區')

    return {
      ...f,
      properties: {
        ...p,
        ...(attrs ?? {}),
        限制區:   zone,
        空域顏色: color,
      },
    }
  })

  console.log('[airspace] spatial join matched:', matched, '/', features.length)

  // Render order: yellow bottom, red on top
  const yellow = normalized.filter((f) => f.properties?.空域顏色 === '黃')
  const red    = normalized.filter((f) => f.properties?.空域顏色 === '紅')
  return { type: 'FeatureCollection', features: [...yellow, ...red] }
}

export async function fetchParksVectorTile(): Promise<FeatureCollection> {
  // 國家公園數量少（台灣約 9 座），直接從 FeatureServer 取完整幾何 + 屬性
  // 不使用 PBF，避免 FS outFields 中文欄位名稱失敗的問題
  const features: Feature[] = []
  let offset = 0
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
      const res = await fetch(`${BASE}/National_Park_fs/FeatureServer/0/query?${params}`)
      if (!res.ok) break
      const data = (await res.json()) as FeatureCollection & { exceededTransferLimit?: boolean }
      features.push(...data.features)
      if (!data.exceededTransferLimit) break
      offset += 2000
    } catch {
      break
    }
  }

  console.log('[parks] FS features:', features.length)
  return { type: 'FeatureCollection', features }
}
