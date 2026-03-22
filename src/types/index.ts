export interface Location {
  lat: number
  lon: number
  name: string
  elevation?: number // 海拔高度 (meters ASL)
}

export interface DroneSpec {
  id: string
  name: string
  brand: string
  maxWindSpeed: number      // m/s
  maxWindSpeedBeaufort: number
  minTemp: number           // °C
  maxTemp: number           // °C
  maxAltitude: number       // meters ASL
  minVisibility: number     // meters
  ipRating: string          // e.g. IP54
  rainResistance: 'none' | 'light' | 'moderate' | 'heavy'
  isCustom?: boolean
}

export type FlightStatus = 'good' | 'caution' | 'danger'

export interface FlightScoreItem {
  label: string
  value: string
  unit: string
  status: FlightStatus
  reason?: string
}

export interface FlightScore {
  overall: FlightStatus
  score: number // 0-100
  items: FlightScoreItem[]
}

export interface CurrentWeather {
  temperature: number       // °C
  feelsLike: number
  humidity: number          // %
  windSpeed: number         // m/s (surface)
  windSpeedAtAltitude?: number // m/s (at flying altitude)
  windDirection: number     // degrees
  windGust?: number         // m/s
  visibility: number        // meters
  cloudCover: number        // %
  cloudBase?: number        // meters
  pressure: number          // hPa
  precipitation: number     // mm/h
  weatherCode: number
  weatherDescription: string
  sunrise: string
  sunset: string
  updatedAt: string
}

export interface HourlyForecast {
  time: string
  temperature: number
  windSpeed: number
  windDirection: number
  windGust: number
  precipitation: number
  precipitationProbability: number
  cloudCover: number
  visibility: number
  weatherCode: number
}

export interface KpData {
  current: number
  forecast: { time: string; kp: number }[]
  status: 'quiet' | 'unsettled' | 'active' | 'minor_storm' | 'major_storm'
  gpsImpact: 'none' | 'minor' | 'moderate' | 'severe'
}

export interface UpperWindData {
  altitude: number   // meters ASL
  windSpeed: number  // m/s
  windDirection: number
}

export interface AltitudeWindProfile {
  surface: UpperWindData
  levels: UpperWindData[]
  atFlightAltitude: UpperWindData
}
