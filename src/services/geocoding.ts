import axios from 'axios'
import { Location } from '../types'

export interface SearchResult {
  name: string
  displayName: string
  lat: number
  lon: number
}

export async function searchLocation(query: string): Promise<SearchResult[]> {
  const response = await axios.get('https://nominatim.openstreetmap.org/search', {
    params: {
      q: query,
      format: 'json',
      limit: 8,
      'accept-language': 'zh-TW,zh,en',
    },
  })

  return response.data.map((item: { display_name: string; lat: string; lon: string }) => ({
    name: item.display_name.split(',')[0],
    displayName: item.display_name,
    lat: parseFloat(item.lat),
    lon: parseFloat(item.lon),
  }))
}

export async function reverseGeocode(lat: number, lon: number): Promise<Location> {
  const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
    params: {
      lat,
      lon,
      format: 'json',
      'accept-language': 'zh-TW,en',
    },
  })

  const d = response.data
  const name =
    d.address?.village ??
    d.address?.town ??
    d.address?.city_district ??
    d.address?.city ??
    d.display_name?.split(',')[0] ??
    `${lat.toFixed(4)}, ${lon.toFixed(4)}`

  return { lat, lon, name }
}
