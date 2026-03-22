import axios from 'axios'
import { CurrentWeather, HourlyForecast } from '../types'

const BASE_URL = 'https://api.weatherapi.com/v1'

// Map critical WeatherAPI condition codes → approximate WMO codes for flight scoring
const WAPI_TO_WMO: Record<number, number> = {
  1087: 95, // Thundery outbreaks → thunderstorm
  1273: 95, // Patchy light rain with thunder
  1276: 95, // Moderate/heavy rain with thunder
  1279: 95, // Patchy light snow with thunder
  1282: 95, // Moderate/heavy snow with thunder
  1225: 75, // Heavy snow
  1219: 73, // Moderate snow
  1255: 73, // Light snow showers
  1258: 73, // Moderate/heavy snow showers
  1201: 55, // Moderate/heavy freezing drizzle
}

function toWmo(code: number): number {
  return WAPI_TO_WMO[code] ?? 0
}

function parseSunTime(str: string): string {
  // "06:15 AM" → "06:15", "06:30 PM" → "18:30"
  const [time, period] = str.trim().split(' ')
  const [h, m] = time.split(':').map(Number)
  const hour24 = period === 'PM' && h !== 12 ? h + 12 : period === 'AM' && h === 12 ? 0 : h
  return `${String(hour24).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export async function fetchWeatherApiFallback(lat: number, lon: number): Promise<{
  current: CurrentWeather
  hourly: HourlyForecast[]
  timezone: string
}> {
  const key = import.meta.env.VITE_WEATHERAPI_KEY
  const response = await axios.get(`${BASE_URL}/forecast.json`, {
    timeout: 12000,
    params: {
      key,
      q: `${lat},${lon}`,
      days: 3,
      aqi: 'no',
      alerts: 'no',
    },
  })

  const d = response.data
  const c = d.current
  const astro = d.forecast.forecastday[0].astro

  const current: CurrentWeather = {
    temperature: Math.round(c.temp_c * 10) / 10,
    feelsLike: Math.round(c.feelslike_c * 10) / 10,
    humidity: c.humidity,
    windSpeed: Math.round((c.wind_kph / 3.6) * 10) / 10,
    windDirection: c.wind_degree,
    windGust: c.gust_kph != null ? Math.round((c.gust_kph / 3.6) * 10) / 10 : undefined,
    visibility: Math.round(c.vis_km * 1000),
    cloudCover: c.cloud,
    pressure: c.pressure_mb,
    precipitation: c.precip_mm ?? 0,
    weatherCode: toWmo(c.condition.code),
    weatherDescription: c.condition.text,
    sunrise: parseSunTime(astro.sunrise),
    sunset: parseSunTime(astro.sunset),
    updatedAt: c.last_updated,
  }

  const hourly: HourlyForecast[] = d.forecast.forecastday
    .flatMap((day: { hour: unknown[] }) => day.hour)
    .slice(0, 72)
    .map((h: {
      time: string
      temp_c: number
      wind_kph: number
      wind_degree: number
      gust_kph?: number
      precip_mm?: number
      chance_of_rain?: number
      cloud: number
      vis_km?: number
      condition: { code: number }
    }) => ({
      time: h.time.replace(' ', 'T'),
      temperature: h.temp_c,
      windSpeed: Math.round((h.wind_kph / 3.6) * 10) / 10,
      windDirection: h.wind_degree,
      windGust: h.gust_kph != null ? Math.round((h.gust_kph / 3.6) * 10) / 10 : 0,
      precipitation: h.precip_mm ?? 0,
      precipitationProbability: h.chance_of_rain ?? 0,
      cloudCover: h.cloud,
      visibility: Math.round((h.vis_km ?? 10) * 1000),
      weatherCode: toWmo(h.condition.code),
    }))

  return { current, hourly, timezone: d.location.tz_id ?? 'Asia/Taipei' }
}
