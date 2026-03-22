import axios from 'axios'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'

dayjs.extend(utc)

// ── localStorage cache ────────────────────────────────────────────────────────
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

interface WindGridCache {
  timestamp: number
  data: VelocityData[]
}

function cacheKey(step: number) {
  return `windgrid_${step}`
}

function readCache(step: number, ignoreExpiry = false): VelocityData[] | null {
  try {
    const raw = localStorage.getItem(cacheKey(step))
    if (!raw) return null
    const cache: WindGridCache = JSON.parse(raw)
    if (!ignoreExpiry && Date.now() - cache.timestamp > CACHE_TTL_MS) return null
    return cache.data
  } catch {
    return null
  }
}

function writeCache(step: number, data: VelocityData[]): void {
  try {
    const cache: WindGridCache = { timestamp: Date.now(), data }
    localStorage.setItem(cacheKey(step), JSON.stringify(cache))
  } catch {
    // localStorage 滿了或不可用，靜默忽略
  }
}

export interface WindGridBounds {
  north: number
  south: number
  west: number
  east: number
}

export interface VelocityData {
  header: {
    parameterCategory: number
    parameterNumber: number
    la1: number
    lo1: number
    la2: number
    lo2: number
    nx: number
    ny: number
    dx: number
    dy: number
  }
  data: number[]
}

function round2(n: number, step: number): number {
  return Math.round(n / step) * step
}

export function stepForZoom(zoom: number): number {
  if (zoom <= 2) return 10
  if (zoom <= 4) return 5
  if (zoom <= 6) return 2
  if (zoom <= 8) return 1
  return 0.5
}

export async function fetchWindGrid(bounds: WindGridBounds, zoom: number): Promise<VelocityData[]> {
  let step = stepForZoom(zoom)

  // Return cached data if still fresh (avoids hitting daily API limit on page refresh)
  const cached = readCache(step)
  if (cached) return cached

  // Snap bounds outward to grid
  const north = Math.min(85, Math.ceil(bounds.north / step) * step)
  const south = Math.max(-85, Math.floor(bounds.south / step) * step)
  // Clamp longitude to [-180, 180]
  const west = Math.max(-180, Math.floor(bounds.west / step) * step)
  const east = Math.min(180, Math.ceil(bounds.east / step) * step)

  // Use Math.floor so the last grid point never overshoots the bound
  let nx = Math.floor((east - west) / step) + 1
  let ny = Math.floor((north - south) / step) + 1
  while (nx * ny > 400 && step < 20) {
    step *= 2
    nx = Math.floor((east - west) / step) + 1
    ny = Math.floor((north - south) / step) + 1
  }

  // Build grid points: north→south rows, west→east columns
  const lats: number[] = []
  const lons: number[] = []
  for (let row = 0; row < ny; row++) {
    const lat = Math.max(-85, Math.min(85, round2(north - row * step, step)))
    for (let col = 0; col < nx; col++) {
      // Clamp each longitude to [-180, 180] to guard against floating-point drift
      const lon = Math.max(-180, Math.min(180, round2(west + col * step, step)))
      lons.push(lon)
      lats.push(lat)
    }
  }

  let res
  try {
    res = await axios.get('https://api.open-meteo.com/v1/forecast', {
      params: {
        latitude: lats.join(','),
        longitude: lons.join(','),
        hourly: 'wind_u_component_10m,wind_v_component_10m',
        forecast_days: 1,
        wind_speed_unit: 'ms',
      },
    })
  } catch (err) {
    const reason: string = (err as { response?: { data?: { reason?: string } } })?.response?.data?.reason ?? ''
    const isRateLimit = reason.toLowerCase().includes('limit')
    throw new WindRateLimitError(isRateLimit ? readCache(step, true) : null)
  }

  const nowStr = dayjs.utc().format('YYYY-MM-DDTHH:00')

  type PointData = {
    hourly: {
      time: string[]
      wind_u_component_10m: number[]
      wind_v_component_10m: number[]
    }
  }

  const raw: PointData[] = Array.isArray(res.data) ? res.data : [res.data]

  const uData: number[] = []
  const vData: number[] = []
  for (const pt of raw) {
    const idx = pt.hourly.time.findIndex(t => t >= nowStr)
    const i = Math.max(0, idx === -1 ? pt.hourly.time.length - 1 : idx)
    uData.push(pt.hourly.wind_u_component_10m[i] ?? 0)
    vData.push(pt.hourly.wind_v_component_10m[i] ?? 0)
  }

  const la1 = round2(north, step)
  const la2 = round2(south, step)
  const lo1 = round2(west, step)
  const lo2 = round2(east, step)
  const header = { la1, lo1, la2, lo2, nx, ny, dx: step, dy: step }

  const result: VelocityData[] = [
    { header: { ...header, parameterCategory: 2, parameterNumber: 2 }, data: uData },
    { header: { ...header, parameterCategory: 2, parameterNumber: 3 }, data: vData },
  ]

  writeCache(step, result)
  return result
}

export class WindRateLimitError extends Error {
  readonly stale: VelocityData[] | null
  constructor(stale: VelocityData[] | null) {
    super('rate_limited')
    this.stale = stale
  }
}
