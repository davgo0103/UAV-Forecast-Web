import {
  Thermometer, Droplets, Eye, Cloud, Wind,
  Gauge, Sunrise, Sunset, ArrowUp
} from 'lucide-react'
import { CurrentWeather } from '../types'
import { windSpeedToBeaufort, BEAUFORT_LABELS } from '../utils/flightScore'
import { AltitudeWindProfile } from '../types'

interface Props {
  weather: CurrentWeather
  altitudeProfile?: AltitudeWindProfile | null
  effectiveAltitudeWind?: number
  altitudeTemperature?: number
}

function StatCard({ icon, label, value, sub }: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="bg-dark-600 rounded-xl p-3 flex items-start gap-3">
      <div className="mt-0.5 text-slate-400">{icon}</div>
      <div>
        <div className="text-xs text-slate-400">{label}</div>
        <div className="text-base font-semibold text-white mt-0.5">{value}</div>
        {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
      </div>
    </div>
  )
}

function WindDirectionArrow({ degrees, variant = 'surface' }: { degrees: number; variant?: 'surface' | 'altitude' }) {
  const isAlt = variant === 'altitude'
  return (
    <div className="relative w-10 h-10 flex items-center justify-center">
      <div
        className={`absolute w-4 h-4 ${isAlt ? 'text-accent-cyan' : 'text-accent-blue'}`}
        style={{ transform: `rotate(${degrees + 180}deg)` }}
      >
        <ArrowUp className="w-4 h-4" />
      </div>
      <div className={`w-8 h-8 rounded-full border ${isAlt ? 'border-accent-cyan/50 border-dashed' : 'border-dark-500'}`} />
    </div>
  )
}

export default function WeatherPanel({ weather, altitudeProfile, effectiveAltitudeWind, altitudeTemperature }: Props) {
  const beaufort = windSpeedToBeaufort(weather.windSpeed)
  const visKm = weather.visibility >= 1000
    ? `${(weather.visibility / 1000).toFixed(1)} km`
    : `${weather.visibility} m`

  const altWind = altitudeProfile?.atFlightAltitude
  // For forecast mode, use the scaled altitude wind passed directly
  const displayAltWindSpeed = effectiveAltitudeWind ?? altWind?.windSpeed
  const displayAltWindDir = altWind?.windDirection
  const displayAltWindAlt = altitudeProfile?.atFlightAltitude.altitude
  const altWindBeaufort = displayAltWindSpeed != null ? windSpeedToBeaufort(displayAltWindSpeed) : null

  return (
    <div className="space-y-4">
      {/* Current conditions */}
      <div className="bg-dark-700 border border-dark-600 rounded-xl p-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-4xl font-black text-white">{weather.temperature}°C</div>
            <div className="text-slate-400 text-sm mt-1">{weather.weatherDescription}</div>
            <div className="text-slate-500 text-xs mt-0.5">體感 {weather.feelsLike}°C</div>
          </div>
          <div className="text-right text-xs text-slate-500">
            <div className="flex items-center gap-1 justify-end">
              <Sunrise className="w-3 h-3" />
              <span>{weather.sunrise}</span>
            </div>
            <div className="flex items-center gap-1 justify-end mt-1">
              <Sunset className="w-3 h-3" />
              <span>{weather.sunset}</span>
            </div>
          </div>
        </div>

        {/* Wind highlight */}
        <div className="bg-dark-600 rounded-xl p-3 mb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-center gap-0.5">
                <WindDirectionArrow degrees={weather.windDirection} />
                <span className="text-xs text-accent-blue font-mono">{weather.windDirection}°</span>
              </div>
              <div>
                <div className="text-xs text-slate-400">地面風速</div>
                <div className="text-xl font-bold text-white">{weather.windSpeed} <span className="text-sm font-normal text-slate-400">m/s</span></div>
                <div className="text-xs text-slate-500">{(weather.windSpeed * 3.6).toFixed(1)} km/h</div>
                <div className="text-xs text-slate-500">{BEAUFORT_LABELS[beaufort]}（{beaufort} 級）</div>
              </div>
            </div>
            {weather.windGust && (
              <div className="text-right">
                <div className="text-xs text-slate-400">陣風</div>
                <div className="text-lg font-semibold text-accent-orange">{weather.windGust} <span className="text-xs font-normal text-slate-500">m/s</span></div>
                <div className="text-xs text-slate-500">{((weather.windGust ?? 0) * 3.6).toFixed(1)} km/h</div>
              </div>
            )}
          </div>
        </div>

        {/* Altitude wind */}
        {displayAltWindSpeed != null && (
          <div className="bg-accent-blue/10 border border-accent-blue/20 rounded-xl p-3 mb-3">
            <div className="text-xs text-accent-cyan mb-2">
              飛行高度風速{displayAltWindAlt ? `（${displayAltWindAlt}m ASL）` : '（預估）'}
            </div>
            <div className="flex items-center w-full gap-2">
              {/* Left: arrow + speed */}
              <div className="flex items-center gap-3 flex-1">
                {displayAltWindDir != null && (
                  <div className="flex flex-col items-center gap-0.5">
                    <WindDirectionArrow degrees={displayAltWindDir} variant="altitude" />
                    <span className="text-xs text-accent-cyan font-mono">{displayAltWindDir}°</span>
                  </div>
                )}
                <div>
                  <div className="text-3xl font-black text-white">
                    {displayAltWindSpeed}
                    <span className="text-base font-normal text-slate-400 ml-1">m/s</span>
                  </div>
                  <div className="text-sm text-slate-400">{(displayAltWindSpeed * 3.6).toFixed(1)} km/h</div>
                  {altWindBeaufort !== null && (
                    <div className="text-xs text-slate-500">{BEAUFORT_LABELS[altWindBeaufort]}（{altWindBeaufort} 級）</div>
                  )}
                </div>
              </div>
              {/* Right: temperature + diff */}
              <div className="flex-1 text-right space-y-1">
                {altitudeTemperature != null && (
                  <div>
                    <div className="text-xs text-slate-400">飛行高度溫度</div>
                    <div className="text-lg font-semibold text-white font-mono">{altitudeTemperature}°C</div>
                  </div>
                )}
                {displayAltWindSpeed > weather.windSpeed && (
                  <div className="text-xs text-accent-red whitespace-nowrap">
                    ↑ 比地面高 {(displayAltWindSpeed - weather.windSpeed).toFixed(1)} m/s
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard icon={<Eye className="w-4 h-4" />} label="能見度" value={visKm} />
        <StatCard icon={<Cloud className="w-4 h-4" />} label="雲量" value={`${weather.cloudCover}%`} />
        <StatCard icon={<Droplets className="w-4 h-4" />} label="濕度" value={`${weather.humidity}%`} />
        <StatCard icon={<Gauge className="w-4 h-4" />} label="氣壓" value={`${Math.round(weather.pressure)} hPa`} />
        <StatCard
          icon={<Thermometer className="w-4 h-4" />}
          label="降水量"
          value={`${weather.precipitation} mm/h`}
          sub={weather.precipitation === 0 ? '無降水' : '有降水'}
        />
        <StatCard
          icon={<Wind className="w-4 h-4" />}
          label="風向"
          value={`${weather.windDirection}°`}
        />
      </div>
    </div>
  )
}
