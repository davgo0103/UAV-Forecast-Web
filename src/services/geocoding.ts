import axios from 'axios'
import { Location } from '../types'

export interface SearchResult {
  name: string
  displayName: string
  lat: number
  lon: number
}

type NominatimItem = {
  display_name: string
  lat: string
  lon: string
  address?: { country_code?: string }
}

async function nominatimSearch(q: string): Promise<NominatimItem[]> {
  const res = await axios.get('https://nominatim.openstreetmap.org/search', {
    params: {
      q,
      format: 'json',
      limit: 10,
      addressdetails: 1,
      'accept-language': 'zh-TW,zh-Hant,en',
    },
  })
  return res.data as NominatimItem[]
}

// Strip trailing address suffixes common in Taiwan (號, 樓, 室, 之X)
function stripAddressSuffix(q: string): string {
  return q.replace(/[\d之]+[號樓室F].*$/, '').trim()
}

export async function searchLocation(query: string): Promise<SearchResult[]> {
  let items = await nominatimSearch(query)

  // If no results and query looks like a detailed address, retry without unit suffix
  if (items.length === 0) {
    const stripped = stripAddressSuffix(query)
    if (stripped && stripped !== query) {
      items = await nominatimSearch(stripped)
    }
  }

  // Sort: Taiwan (tw) first, mainland China (cn) last
  const sorted = [...items].sort((a, b) => {
    const ca = a.address?.country_code ?? ''
    const cb = b.address?.country_code ?? ''
    if (ca === 'tw' && cb !== 'tw') return -1
    if (cb === 'tw' && ca !== 'tw') return 1
    if (ca === 'cn' && cb !== 'cn') return 1
    if (cb === 'cn' && ca !== 'cn') return -1
    return 0
  })

  return sorted.slice(0, 8).map((item) => ({
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
