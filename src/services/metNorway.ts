import axios from 'axios'
import { CurrentWeather, HourlyForecast } from '../types'

const BASE_URL = 'https://api.met.no/weatherapi/locationforecast/2.0/compact'

// MET Norway symbol_code → approximate WMO code
function symbolToWmo(symbol: string): number {
  if (symbol.startsWith('thunder')) return 95
  if (symbol.startsWith('heavysnow') || symbol.startsWith('heavysleet')) return 75
  if (symbol.startsWith('snow') || symbol.startsWith('sleet')) return 73
  if (symbol.startsWith('heavyrain')) return 65
  if (symbol.startsWith('rain') || symbol.startsWith('lightrain')) return 61
  if (symbol.startsWith('drizzle') || symbol.startsWith('lightsleet')) return 51
  if (symbol.startsWith('fog')) return 45
  return 0
}

interface METInstant {
  air_temperature: number
  relative_humidity: number
  wind_speed: number
  wind_from_direction: number
  wind_speed_of_gust?: number
  cloud_area_fraction: number
  air_pressure_at_sea_level: number
}

interface METNext1h {
  summary?: { symbol_code: string }
  details?: { precipitation_amount?: number; probability_of_precipitation?: number }
}

interface METEntry {
  time: string
  data: {
    instant: { details: METInstant }
    next_1_hours?: METNext1h
    next_6_hours?: METNext1h
  }
}

export async function fetchMetNorwayFallback(lat: number, lon: number): Promise<{
  current: CurrentWeather
  hourly: HourlyForecast[]
  timezone: string
}> {
  const response = await axios.get(BASE_URL, {
    timeout: 12000,
    params: { lat: lat.toFixed(4), lon: lon.toFixed(4) },
    headers: { 'User-Agent': 'UAVForecastWeb/1.0 github.com/uav-forecast' },
  })

  const timeseries: METEntry[] = response.data.properties.timeseries
  if (!timeseries?.length) throw new Error('MET Norway: empty timeseries')

  const first = timeseries[0]
  const inst = first.data.instant.details
  const next = first.data.next_1_hours ?? first.data.next_6_hours
  const symbol = next?.summary?.symbol_code ?? ''

  const current: CurrentWeather = {
    temperature: Math.round(inst.air_temperature * 10) / 10,
    feelsLike: Math.round(inst.air_temperature * 10) / 10, // MET doesn't provide feels-like
    humidity: Math.round(inst.relative_humidity),
    windSpeed: Math.round(inst.wind_speed * 10) / 10,
    windDirection: Math.round(inst.wind_from_direction),
    windGust: inst.wind_speed_of_gust != null ? Math.round(inst.wind_speed_of_gust * 10) / 10 : undefined,
    visibility: 10000, // MET compact doesn't include visibility
    cloudCover: Math.round(inst.cloud_area_fraction),
    pressure: Math.round(inst.air_pressure_at_sea_level * 10) / 10,
    precipitation: next?.details?.precipitation_amount ?? 0,
    weatherCode: symbolToWmo(symbol),
    weatherDescription: symbol.replace(/_/g, ' ') || '—',
    sunrise: '',
    sunset: '',
    updatedAt: first.time,
  }

  const hourly: HourlyForecast[] = timeseries.slice(0, 72).map((entry) => {
    const d = entry.data.instant.details
    const n = entry.data.next_1_hours ?? entry.data.next_6_hours
    return {
      time: entry.time,
      temperature: d.air_temperature,
      windSpeed: Math.round(d.wind_speed * 10) / 10,
      windDirection: Math.round(d.wind_from_direction),
      windGust: d.wind_speed_of_gust ?? 0,
      precipitation: n?.details?.precipitation_amount ?? 0,
      precipitationProbability: n?.details?.probability_of_precipitation ?? 0,
      cloudCover: Math.round(d.cloud_area_fraction),
      visibility: 10000,
      weatherCode: symbolToWmo(n?.summary?.symbol_code ?? ''),
    }
  })

  return { current, hourly, timezone: 'UTC' }
}
