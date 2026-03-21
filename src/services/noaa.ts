import axios from 'axios'
import { KpData } from '../types'

const NOAA_BASE = 'https://services.swpc.noaa.gov'

function kpToStatus(kp: number): KpData['status'] {
  if (kp < 2) return 'quiet'
  if (kp < 3) return 'unsettled'
  if (kp < 5) return 'active'
  if (kp < 7) return 'minor_storm'
  return 'major_storm'
}

function kpToGpsImpact(kp: number): KpData['gpsImpact'] {
  if (kp < 3) return 'none'
  if (kp < 5) return 'minor'
  if (kp < 7) return 'moderate'
  return 'severe'
}

export async function fetchKpIndex(): Promise<KpData> {
  const [currentRes] = await Promise.allSettled([
    axios.get(`${NOAA_BASE}/json/planetary_k_index_1m.json`),
  ])

  let currentKp = 0

  if (currentRes.status === 'fulfilled') {
    const data = currentRes.value.data
    if (Array.isArray(data) && data.length > 0) {
      const latest = data[data.length - 1]
      currentKp = parseFloat(latest.kp_index ?? latest.kp ?? 0)
    }
  }

  // 3-day Kp forecast from NOAA
  let forecast: { time: string; kp: number }[] = []
  try {
    const fRes = await axios.get(`${NOAA_BASE}/products/noaa-planetary-k-index-forecast.json`)
    const fData = fRes.data
    if (Array.isArray(fData)) {
      forecast = fData.slice(1, 13).map((row: string[]) => ({
        time: row[0],
        kp: parseFloat(row[1] ?? '0'),
      }))
    }
  } catch {
    // fallback: empty forecast
  }

  return {
    current: currentKp,
    forecast,
    status: kpToStatus(currentKp),
    gpsImpact: kpToGpsImpact(currentKp),
  }
}
