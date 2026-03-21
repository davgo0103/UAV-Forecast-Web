import { useState } from 'react'
import { Map, Settings2, Wind, Loader2, AlertCircle } from 'lucide-react'
import SearchBar from '../SearchBar'
import LocateButton from '../LocateButton'
import FlightScoreCard from '../FlightScoreCard'
import WeatherPanel from '../WeatherPanel'
import KpIndexCard from '../KpIndexCard'
import ForecastChart from '../ForecastChart'
import TimeSlider from '../TimeSlider'
import MobileMapOverlay from './MobileMapOverlay'
import SettingsSheet from './SettingsSheet'
import { FlightScore, FlightStatus, CurrentWeather, AltitudeWindProfile } from '../../types'
import { DroneSpec, HourlyForecast } from '../../types'
import { useStore } from '../../store/useStore'
import CreditCard from '../CreditCard'

interface Props {
  location: ReturnType<typeof useStore.getState>['location']
  displayWeather: CurrentWeather | null
  flightScore: FlightScore | null
  hourlyForecast: HourlyForecast[]
  hourStatuses: FlightStatus[]
  selectedDrone: DroneSpec
  selectedHourIndex: number
  altitudeProfile: AltitudeWindProfile | null
  effectiveAltitudeWind: number | undefined
  isLoadingWeather: boolean
  error: string | null
  kpData: ReturnType<typeof useStore.getState>['kpData']
}

export default function MobileLayout({
  location,
  displayWeather,
  flightScore,
  hourlyForecast,
  hourStatuses,
  selectedDrone,
  selectedHourIndex,
  altitudeProfile,
  effectiveAltitudeWind,
  isLoadingWeather,
  error,
  kpData,
}: Props) {
  const [mapOpen, setMapOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <div
      className="flex flex-col bg-dark-900 text-white"
      style={{ height: '100dvh', paddingTop: 'env(safe-area-inset-top)' }}
    >
      {/* Mobile header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-dark-800 border-b border-dark-600 flex-shrink-0">
        <div className="flex items-center gap-2 flex-1">
          <Wind className="w-4 h-4 text-accent-blue" />
          <span className="font-bold text-white tracking-wide text-sm">UAV Forecast Taiwan</span>
        </div>
        <button
          onClick={() => setSettingsOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dark-600 border border-dark-500 text-slate-300 text-xs active:bg-dark-500"
        >
          <Settings2 className="w-3.5 h-3.5" />
          <span>{selectedDrone.brand} {selectedDrone.name}</span>
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
        <div className="px-4 py-3 space-y-3">

          {/* Search + Locate */}
          <SearchBar />
          <LocateButton />

          {/* Open Map Button */}
          <button
            onClick={() => setMapOpen(true)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-dark-700 border border-dark-600 active:bg-dark-600 transition-colors"
          >
            <div className="w-8 h-8 rounded-lg bg-accent-blue/20 flex items-center justify-center flex-shrink-0">
              <Map className="w-4 h-4 text-accent-blue" />
            </div>
            <div className="flex-1 text-left">
              <div className="text-sm font-medium text-white">
                {location ? location.name : '點選開啟地圖'}
              </div>
              {location && (
                <div className="text-xs text-slate-500 mt-0.5">
                  {location.lat.toFixed(4)}, {location.lon.toFixed(4)}
                  {location.elevation != null ? ` · 海拔 ${location.elevation}m` : ''}
                </div>
              )}
            </div>
            <span className="text-xs text-slate-500">全螢幕 →</span>
          </button>

          {/* Loading */}
          {isLoadingWeather && (
            <div className="flex items-center justify-center gap-3 py-6">
              <Loader2 className="w-5 h-5 text-accent-blue animate-spin" />
              <span className="text-sm text-slate-400">載入天氣資料中...</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-3 bg-accent-red/10 border border-accent-red/30 rounded-xl p-4">
              <AlertCircle className="w-4 h-4 text-accent-red flex-shrink-0 mt-0.5" />
              <div className="text-sm text-accent-red">{error}</div>
            </div>
          )}

          {/* Time slider */}
          {hourlyForecast.length > 0 && hourStatuses.length > 0 && (
            <TimeSlider maxHours={48} hourStatuses={hourStatuses} forecastFromNow={hourlyForecast} />
          )}

          {/* Flight score */}
          {flightScore && (
            <FlightScoreCard
              score={flightScore}
              droneName={`${selectedDrone.brand} ${selectedDrone.name}`}
              isForecast={selectedHourIndex > 0}
            />
          )}

          {/* Weather panel */}
          {displayWeather && (
            <WeatherPanel
              weather={displayWeather}
              altitudeProfile={selectedHourIndex === 0 ? altitudeProfile : null}
              effectiveAltitudeWind={selectedHourIndex > 0 ? effectiveAltitudeWind : undefined}
            />
          )}

          {/* Kp index */}
          {kpData && <KpIndexCard kp={kpData} isForecast={selectedHourIndex > 0} />}

          {/* Forecast chart */}
          {hourlyForecast.length > 0 && (
            <div className="h-64">
              <ForecastChart
                forecast={hourlyForecast}
                drone={selectedDrone}
                selectedHourIndex={selectedHourIndex}
              />
            </div>
          )}

          {/* Credit */}
          <div className="flex justify-end pr-1">
            <CreditCard />
          </div>

          {/* Bottom padding for safe area */}
          <div style={{ height: 'max(env(safe-area-inset-bottom), 16px)' }} />
        </div>
      </div>

      {/* Overlays */}
      {mapOpen && (
        <MobileMapOverlay
          onClose={() => setMapOpen(false)}
          flightStatus={flightScore?.overall}
        />
      )}
      {settingsOpen && (
        <SettingsSheet onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  )
}
