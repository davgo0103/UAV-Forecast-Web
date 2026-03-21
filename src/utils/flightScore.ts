import { DroneSpec, CurrentWeather, KpData, FlightScore, FlightScoreItem, FlightStatus } from '../types'

function getWindStatus(windSpeed: number, drone: DroneSpec): { status: FlightStatus; reason?: string } {
  if (windSpeed >= drone.maxWindSpeed) {
    return { status: 'danger', reason: `風速 ${windSpeed} m/s 超過 ${drone.name} 最大耐風 ${drone.maxWindSpeed} m/s` }
  }
  if (windSpeed >= drone.maxWindSpeed * 0.7) {
    return { status: 'caution', reason: `風速接近 ${drone.name} 最大耐風上限` }
  }
  return { status: 'good' }
}

function getVisibilityStatus(visibility: number, drone: DroneSpec): { status: FlightStatus; reason?: string } {
  if (visibility < drone.minVisibility) {
    return { status: 'danger', reason: `能見度 ${(visibility / 1000).toFixed(1)} km 低於最低要求 ${drone.minVisibility}m` }
  }
  if (visibility < drone.minVisibility * 2) {
    return { status: 'caution', reason: '能見度偏低，建議謹慎操作' }
  }
  return { status: 'good' }
}

function getTempStatus(temp: number, drone: DroneSpec): { status: FlightStatus; reason?: string } {
  if (temp < drone.minTemp || temp > drone.maxTemp) {
    return {
      status: 'danger',
      reason: `氣溫 ${temp}°C 超出 ${drone.name} 工作溫度範圍 (${drone.minTemp}°C ~ ${drone.maxTemp}°C)`,
    }
  }
  if (temp < drone.minTemp + 5 || temp > drone.maxTemp - 5) {
    return { status: 'caution', reason: '溫度接近機體工作極限' }
  }
  return { status: 'good' }
}

function getPrecipitationStatus(
  precipitation: number,
  drone: DroneSpec
): { status: FlightStatus; reason?: string } {
  if (drone.rainResistance === 'none') {
    if (precipitation > 0) {
      return { status: 'danger', reason: '降雨中，此機型無防水設計' }
    }
  } else if (drone.rainResistance === 'light') {
    if (precipitation > 2.5) {
      return { status: 'danger', reason: '中大雨，超過機體防水等級' }
    }
    if (precipitation > 0) {
      return { status: 'caution', reason: '有降雨，雖有防潑水設計但仍需謹慎' }
    }
  } else {
    if (precipitation > 7.5) {
      return { status: 'danger', reason: '大雨，超過機體防水等級' }
    }
    if (precipitation > 2.5) {
      return { status: 'caution', reason: '中雨，謹慎飛行' }
    }
  }
  return { status: 'good' }
}

function getKpStatus(kp: number): { status: FlightStatus; reason?: string } {
  if (kp >= 5) {
    return { status: 'danger', reason: `Kp=${kp} 地磁活動強烈，GPS 精度嚴重下降` }
  }
  if (kp >= 3) {
    return { status: 'caution', reason: `Kp=${kp} 地磁活動偏高，GPS 可能受影響` }
  }
  return { status: 'good' }
}

function worstStatus(statuses: FlightStatus[]): FlightStatus {
  if (statuses.includes('danger')) return 'danger'
  if (statuses.includes('caution')) return 'caution'
  return 'good'
}

function statusScore(status: FlightStatus): number {
  if (status === 'good') return 100
  if (status === 'caution') return 55
  return 15
}

function windDirectionLabel(deg: number): string {
  const dirs = ['北', '北北東', '東北', '東北東', '東', '東南東', '東南', '南南東',
    '南', '南南西', '西南', '西南西', '西', '西北西', '西北', '北北西']
  return dirs[Math.round(deg / 22.5) % 16]
}

export function computeFlightScore(
  weather: CurrentWeather,
  drone: DroneSpec,
  kp: KpData | null,
  effectiveWindSpeed?: number // wind at flight altitude
): FlightScore {
  const windSpeedToEval = effectiveWindSpeed ?? weather.windSpeed

  const windResult = getWindStatus(windSpeedToEval, drone)
  const visResult = getVisibilityStatus(weather.visibility, drone)
  const tempResult = getTempStatus(weather.temperature, drone)
  const rainResult = getPrecipitationStatus(weather.precipitation, drone)
  const kpResult = kp ? getKpStatus(kp.current) : { status: 'good' as FlightStatus }

  const items: FlightScoreItem[] = [
    {
      label: '風速',
      value: `${windSpeedToEval}`,
      unit: 'm/s',
      status: windResult.status,
      reason: windResult.reason,
    },
    {
      label: '陣風',
      value: `${weather.windGust ?? '-'}`,
      unit: 'm/s',
      status: weather.windGust && weather.windGust >= drone.maxWindSpeed ? 'danger'
        : weather.windGust && weather.windGust >= drone.maxWindSpeed * 0.7 ? 'caution'
        : 'good',
    },
    {
      label: '風向',
      value: `${windDirectionLabel(weather.windDirection)} ${weather.windDirection}°`,
      unit: '',
      status: 'good',
    },
    {
      label: '能見度',
      value: weather.visibility >= 1000
        ? `${(weather.visibility / 1000).toFixed(1)}`
        : `${weather.visibility}`,
      unit: weather.visibility >= 1000 ? 'km' : 'm',
      status: visResult.status,
      reason: visResult.reason,
    },
    {
      label: '溫度',
      value: `${weather.temperature}`,
      unit: '°C',
      status: tempResult.status,
      reason: tempResult.reason,
    },
    {
      label: '降水量',
      value: `${weather.precipitation}`,
      unit: 'mm/h',
      status: rainResult.status,
      reason: rainResult.reason,
    },
    {
      label: 'Kp 指數',
      value: kp ? `${kp.current}` : '-',
      unit: '',
      status: kpResult.status,
      reason: kpResult.reason,
    },
  ]

  const allStatuses = items.map((i) => i.status)
  const overall = worstStatus(allStatuses)

  const avgScore =
    items.reduce((sum, item) => sum + statusScore(item.status), 0) / items.length

  return { overall, score: Math.round(avgScore), items }
}

export function windSpeedToBeaufort(ms: number): number {
  if (ms < 0.3) return 0
  if (ms < 1.6) return 1
  if (ms < 3.4) return 2
  if (ms < 5.5) return 3
  if (ms < 8.0) return 4
  if (ms < 10.8) return 5
  if (ms < 13.9) return 6
  if (ms < 17.2) return 7
  if (ms < 20.8) return 8
  if (ms < 24.5) return 9
  if (ms < 28.5) return 10
  if (ms < 32.7) return 11
  return 12
}

export const BEAUFORT_LABELS: Record<number, string> = {
  0: '無風',
  1: '軟風',
  2: '輕風',
  3: '微風',
  4: '和風',
  5: '清勁風',
  6: '強風',
  7: '疾風',
  8: '大風',
  9: '烈風',
  10: '狂風',
  11: '暴風',
  12: '颶風',
}
