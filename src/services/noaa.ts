import axios from 'axios'
import dayjs from 'dayjs'
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

/**
 * Given a target time string (location local time, e.g. "2024-03-21T15:00")
 * and a KpData object, return the effective Kp for that time.
 * NOAA forecast times are UTC; we convert before comparing.
 */
export function getEffectiveKp(kpData: KpData, targetTimeLocal: string, tz = 'Asia/Taipei'): KpData {
  if (!kpData.forecast.length) return kpData

  // targetTimeLocal is a naive local time string — interpret in the location's timezone, then convert to UTC
  const targetUtc = dayjs.tz(targetTimeLocal, tz).utc()

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

  // Only show forecast entries at or after the selected time
  const futureForecast = kpData.forecast.filter(
    entry => dayjs.utc(entry.time).diff(targetUtc, 'minute') >= -90
  )

  return {
    ...kpData,
    current: closestKp,
    status: kpToStatus(closestKp),
    gpsImpact: kpToGpsImpact(closestKp),
    forecast: futureForecast,
  }
}

export async function fetchKpIndex(): Promise<KpData> {
  // Use official 3-hourly Kp product (observed + predicted in one file)
  let currentKp = 0
  let forecast: { time: string; kp: number }[] = []

  try {
    // This file contains both observed (past) and predicted (future) 3-hourly Kp values
    const res = await axios.get(`${NOAA_BASE}/products/noaa-planetary-k-index-forecast.json`)
    const data: string[][] = res.data
    if (Array.isArray(data) && data.length > 1) {
      const rows = data.slice(1) // skip header row
      const nowUtc = dayjs.utc()

      // Find the entry (observed or predicted) whose 3-hour window contains "now".
      // observed entries can lag >3 hours behind, so we pick the closest one regardless of status.
      let minDiff = Infinity
      for (const row of rows) {
        const diff = Math.abs(dayjs.utc(row[0]).diff(nowUtc, 'minute'))
        if (diff < minDiff) {
          minDiff = diff
          currentKp = parseFloat(row[1] ?? '0')
        }
      }

      // Forecast: all entries starting from ~now (include the current 3-hour block too)
      forecast = rows
        .filter(row => dayjs.utc(row[0]).diff(nowUtc, 'minute') >= -90)
        .map(row => ({ time: row[0], kp: parseFloat(row[1] ?? '0') }))
    }
  } catch {
    // fallback: keep defaults
  }

  return {
    current: currentKp,
    forecast,
    status: kpToStatus(currentKp),
    gpsImpact: kpToGpsImpact(currentKp),
  }
}
