import axios from 'axios'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import { KpData } from '../types'

dayjs.extend(utc)

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

/**
 * Given a target time string (Asia/Taipei, e.g. "2024-03-21T15:00")
 * and a KpData object, return the effective Kp for that time.
 * NOAA forecast times are UTC; we convert before comparing.
 */
export function getEffectiveKp(kpData: KpData, targetTimeLocal: string): KpData {
  if (!kpData.forecast.length) return kpData

  // targetTimeLocal is Asia/Taipei (UTC+8) — convert to UTC for comparison
  const targetUtc = dayjs(targetTimeLocal).utcOffset(8).utc()

  // Find the forecast entry whose 3-hour window contains the target time
  let closestKp = kpData.forecast[0].kp
  let minDiff = Infinity

  for (const entry of kpData.forecast) {
    // NOAA times are like "2024-03-21 00:00:00" in UTC
    const entryUtc = dayjs.utc(entry.time)
    const diff = Math.abs(entryUtc.diff(targetUtc, 'minute'))
    if (diff < minDiff) {
      minDiff = diff
      closestKp = entry.kp
    }
  }

  return {
    ...kpData,
    current: closestKp,
    status: kpToStatus(closestKp),
    gpsImpact: kpToGpsImpact(closestKp),
  }
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
