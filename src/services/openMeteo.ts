import axios from 'axios'
import { CurrentWeather, HourlyForecast, UpperWindData, AltitudeWindProfile } from '../types'
import { WEATHER_CODE_MAP } from '../data/drones'
import { fetchWeatherApiFallback } from './weatherApi'
import { fetchMetNorwayFallback } from './metNorway'

const BASE_URL = 'https://api.open-meteo.com/v1'

// ── Weather cache ─────────────────────────────────────────────────────────────
const WEATHER_CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes

interface WeatherCache {
  timestamp: number
  data: {
    current: CurrentWeather
    hourly: HourlyForecast[]
    upperWinds: UpperWindData[]
    elevation: number
    timezone: string
    model: string
  }
}

function weatherCacheKey(lat: number, lon: number) {
  return `weather_${lat.toFixed(3)}_${lon.toFixed(3)}`
}

function readWeatherCache(lat: number, lon: number, ignoreExpiry = false): WeatherCache['data'] | null {
  try {
    const raw = localStorage.getItem(weatherCacheKey(lat, lon))
    if (!raw) return null
    const cache: WeatherCache = JSON.parse(raw)
    if (!ignoreExpiry && Date.now() - cache.timestamp > WEATHER_CACHE_TTL_MS) return null
    return cache.data
  } catch {
    return null
  }
}

function writeWeatherCache(lat: number, lon: number, data: WeatherCache['data']): void {
  try {
    localStorage.setItem(weatherCacheKey(lat, lon), JSON.stringify({ timestamp: Date.now(), data }))
  } catch { }
}

// Only use pressure levels reliably available in Open-Meteo hourly
const PRESSURE_LEVELS = [
  { hPa: 925, altM: 760 },
  { hPa: 850, altM: 1460 },
  { hPa: 800, altM: 1950 },
  { hPa: 700, altM: 3010 },
  { hPa: 600, altM: 4200 },
  { hPa: 500, altM: 5570 },
]

async function withRetry<T>(fn: () => Promise<T>, retries = 2, delayMs = 800): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (retries <= 0) throw err
    await new Promise((r) => setTimeout(r, delayMs))
    return withRetry(fn, retries - 1, delayMs * 1.5)
  }
}

/**
 * Main weather request: current + hourly + daily sunrise/sunset
 * Kept lean — no pressure level vars to avoid 400 on unsupported regions
 */
async function fetchMainWeather(lat: number, lon: number) {
  const response = await withRetry(() =>
    axios.get(`${BASE_URL}/forecast`, {
      timeout: 12000,
      params: {
        latitude: lat,
        longitude: lon,
        current: [
          'temperature_2m',
          'apparent_temperature',
          'relative_humidity_2m',
          'wind_speed_10m',
          'wind_direction_10m',
          'wind_gusts_10m',
          'visibility',
          'cloud_cover',
          'surface_pressure',
          'precipitation',
          'weather_code',
        ].join(','),
        hourly: [
          'temperature_2m',
          'wind_speed_10m',
          'wind_direction_10m',
          'wind_gusts_10m',
          'precipitation',
          'precipitation_probability',
          'cloud_cover',
          'visibility',
          'weather_code',
        ].join(','),
        daily: 'sunrise,sunset',
        forecast_days: 3,
        timezone: 'auto',
        wind_speed_unit: 'ms',
      },
    })
  )
  return response.data
}

/**
 * Optional pressure-level winds — fails silently if region unsupported
 */
async function fetchUpperWindsSilent(lat: number, lon: number): Promise<UpperWindData[]> {
  try {
    const pressureVars: string[] = []
    for (const level of PRESSURE_LEVELS) {
      pressureVars.push(`wind_speed_${level.hPa}hPa`)
      pressureVars.push(`wind_direction_${level.hPa}hPa`)
    }
    const response = await axios.get(`${BASE_URL}/forecast`, {
      timeout: 10000,
      params: {
        latitude: lat,
        longitude: lon,
        hourly: pressureVars.join(','),
        forecast_days: 1,
        timezone: 'auto',
        wind_speed_unit: 'ms',
      },
    })
    const h = response.data.hourly
    return PRESSURE_LEVELS.map((level) => ({
      altitude: level.altM,
      windSpeed: h[`wind_speed_${level.hPa}hPa`]?.[0] ?? 0,
      windDirection: h[`wind_direction_${level.hPa}hPa`]?.[0] ?? 0,
    })).filter((w) => w.windSpeed > 0)
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[openMeteo] fetchUpperWinds failed:', err)
    return [] // non-fatal — fall back to surface wind only
  }
}

export async function fetchAllWeatherData(lat: number, lon: number): Promise<{
  current: CurrentWeather
  hourly: HourlyForecast[]
  upperWinds: UpperWindData[]
  elevation: number
  timezone: string
  model: string
}> {
  // Return fresh cache if available
  const fresh = readWeatherCache(lat, lon)
  if (fresh) return fresh

  let d: Awaited<ReturnType<typeof fetchMainWeather>>
  let upperWinds: UpperWindData[]

  try {
    ;[d, upperWinds] = await Promise.all([
      fetchMainWeather(lat, lon),
      fetchUpperWindsSilent(lat, lon),
    ])
  } catch (err) {
    // On rate limit, return stale cache if available; otherwise re-throw
    const reason: string = (err as { response?: { data?: { reason?: string } } })?.response?.data?.reason ?? ''
    if (reason.toLowerCase().includes('limit')) {
      const stale = readWeatherCache(lat, lon, true)
      if (stale) return stale
      // No stale cache — try WeatherAPI, then MET Norway
      let fb: Awaited<ReturnType<typeof fetchWeatherApiFallback>>
      let fbModel: string
      try {
        fb = await fetchWeatherApiFallback(lat, lon)
        fbModel = 'WeatherAPI'
      } catch {
        fb = await fetchMetNorwayFallback(lat, lon)
        fbModel = 'MET Norway'
      }
      const elevation = await fetchElevation(lat, lon)
      return { ...fb, upperWinds: [] as UpperWindData[], elevation, model: fbModel }
    }
    throw err
  }

  const c = d.current
  const elevation: number = d.elevation ?? 0
  const sunrise: string = d.daily?.sunrise?.[0]?.split('T')[1] ?? ''
  const sunset: string = d.daily?.sunset?.[0]?.split('T')[1] ?? ''

  const current: CurrentWeather = {
    temperature: Math.round(c.temperature_2m * 10) / 10,
    feelsLike: Math.round(c.apparent_temperature * 10) / 10,
    humidity: c.relative_humidity_2m,
    windSpeed: Math.round(c.wind_speed_10m * 10) / 10,
    windDirection: c.wind_direction_10m,
    windGust: c.wind_gusts_10m != null ? Math.round(c.wind_gusts_10m * 10) / 10 : undefined,
    visibility: c.visibility ?? 10000,
    cloudCover: c.cloud_cover,
    pressure: c.surface_pressure,
    precipitation: c.precipitation ?? 0,
    weatherCode: c.weather_code,
    weatherDescription: WEATHER_CODE_MAP[c.weather_code] ?? '未知',
    sunrise,
    sunset,
    updatedAt: c.time,
  }

  const times: string[] = d.hourly.time
  const hourly: HourlyForecast[] = times.slice(0, 72).map((time: string, i: number) => ({
    time,
    temperature: d.hourly.temperature_2m[i],
    windSpeed: d.hourly.wind_speed_10m[i],
    windDirection: d.hourly.wind_direction_10m[i],
    windGust: d.hourly.wind_gusts_10m?.[i] ?? 0,
    precipitation: d.hourly.precipitation?.[i] ?? 0,
    precipitationProbability: d.hourly.precipitation_probability?.[i] ?? 0,
    cloudCover: d.hourly.cloud_cover[i],
    visibility: d.hourly.visibility?.[i] ?? 10000,
    weatherCode: d.hourly.weather_code[i],
  }))

  const result = { current, hourly, upperWinds, elevation, timezone: d.timezone ?? 'Asia/Taipei', model: d.model ?? 'best_match' }
  writeWeatherCache(lat, lon, result)
  return result
}

export async function fetchElevation(lat: number, lon: number): Promise<number> {
  try {
    const response = await withRetry(() =>
      axios.get(`${BASE_URL}/elevation`, {
        timeout: 8000,
        params: { latitude: lat, longitude: lon },
      })
    )
    return response.data.elevation?.[0] ?? 0
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[openMeteo] fetchElevation failed:', err)
    return 0
  }
}

export function interpolateWindAtAltitude(
  levels: UpperWindData[],
  surfaceWind: { speed: number; direction: number },
  targetAltitude: number
): UpperWindData {
  const profile: UpperWindData[] = [
    { altitude: 10, windSpeed: surfaceWind.speed, windDirection: surfaceWind.direction },
    ...levels,
  ]

  if (targetAltitude <= 10) return profile[0]

  let lower = profile[0]
  let upper = profile[profile.length - 1]

  for (let i = 0; i < profile.length - 1; i++) {
    if (profile[i].altitude <= targetAltitude && profile[i + 1].altitude >= targetAltitude) {
      lower = profile[i]
      upper = profile[i + 1]
      break
    }
  }

  if (lower.altitude === upper.altitude) return lower

  const ratio = (targetAltitude - lower.altitude) / (upper.altitude - lower.altitude)
  const windSpeed = lower.windSpeed + ratio * (upper.windSpeed - lower.windSpeed)

  let dirDiff = upper.windDirection - lower.windDirection
  if (dirDiff > 180) dirDiff -= 360
  if (dirDiff < -180) dirDiff += 360
  const windDirection = (lower.windDirection + ratio * dirDiff + 360) % 360

  return {
    altitude: targetAltitude,
    windSpeed: Math.round(windSpeed * 10) / 10,
    windDirection: Math.round(windDirection),
  }
}

export function buildAltitudeWindProfile(
  levels: UpperWindData[],
  surfaceWind: { speed: number; direction: number },
  terrainElevation: number,
  aglHeight: number
): AltitudeWindProfile {
  const flightAltitudeMSL = terrainElevation + aglHeight
  const atFlightAltitude = interpolateWindAtAltitude(levels, surfaceWind, flightAltitudeMSL)

  return {
    surface: {
      altitude: terrainElevation + 10,
      windSpeed: surfaceWind.speed,
      windDirection: surfaceWind.direction,
    },
    levels,
    atFlightAltitude,
  }
}
