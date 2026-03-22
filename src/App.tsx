import { useMemo, useState, useEffect } from 'react'
import dayjs from 'dayjs'
import { Loader2, MapPin, AlertCircle, RefreshCw, ChevronDown, BarChart2 } from 'lucide-react'
import Header from './components/Header'
import CreditCard from './components/CreditCard'
import SearchBar from './components/SearchBar'
import MapView from './components/MapView'
import WeatherPanel from './components/WeatherPanel'
import FlightScoreCard from './components/FlightScoreCard'
import KpIndexCard from './components/KpIndexCard'
import ForecastChart from './components/ForecastChart'
import DroneSelector from './components/DroneSelector'
import AltitudeInput from './components/AltitudeInput'
import EmptyState from './components/EmptyState'
import TimeSlider from './components/TimeSlider'
import LocateButton from './components/LocateButton'
import MobileLayout from './components/mobile/MobileLayout'
import { useStore } from './store/useStore'
import { useWeatherData } from './hooks/useWeatherData'
import { computeFlightScore } from './utils/flightScore'
import { CurrentWeather, FlightStatus } from './types'
import { WEATHER_CODE_MAP } from './data/drones'
import { useMediaQuery } from './hooks/useMediaQuery'
import { getEffectiveKp } from './services/noaa'

/** Convert an HourlyForecast slot into a CurrentWeather-compatible shape for display */
function forecastToCurrentWeather(
  forecast: ReturnType<typeof useStore.getState>['hourlyForecast'][0],
  base: CurrentWeather
): CurrentWeather {
  return {
    ...base,
    temperature: forecast.temperature,
    feelsLike: forecast.temperature, // no feels-like in hourly
    windSpeed: forecast.windSpeed,
    windDirection: forecast.windDirection,
    windGust: forecast.windGust,
    visibility: forecast.visibility,
    cloudCover: forecast.cloudCover,
    precipitation: forecast.precipitation,
    weatherCode: forecast.weatherCode,
    weatherDescription: WEATHER_CODE_MAP[forecast.weatherCode] ?? '未知',
    updatedAt: forecast.time,
  }
}

/** Scale altitude wind proportionally from surface wind change */
function scaledAltitudeWind(
  surfaceNow: number,
  surfaceForecast: number,
  altitudeNow: number
): number {
  if (surfaceNow === 0) return surfaceForecast
  const ratio = surfaceForecast / surfaceNow
  return Math.round(altitudeNow * ratio * 10) / 10
}

export default function App() {
  useWeatherData()
  const isMobile = useMediaQuery('(max-width: 767px)')

  const {
    location,
    currentWeather,
    hourlyForecast,
    kpData,
    altitudeWindProfile,
    selectedDrone,
    selectedHourIndex,
    aglHeight,
    terrainElevation,
    isLoadingWeather,
    error,
    locationTimezone,
  } = useStore()

  const LAPSE_RATE = 6.5 / 1000 // °C per meter

  const MAX_HOURS = 48

  // Current minute — updates every 60s so nowForecastIndex stays accurate when page is left open
  const [nowMinute, setNowMinute] = useState(() => dayjs().startOf('hour').valueOf())
  useEffect(() => {
    const id = setInterval(() => setNowMinute(dayjs().startOf('hour').valueOf()), 60_000)
    return () => clearInterval(id)
  }, [])

  // Find the index of the current hour in hourlyForecast
  // Compare using location's timezone so non-Taiwan locations are correct
  const nowForecastIndex = useMemo(() => {
    if (hourlyForecast.length === 0) return 0
    // Truncate to the current hour so 09:19 maps to the 09:00 slot, not 10:00
    const nowLocal = dayjs(nowMinute).tz(locationTimezone).startOf('hour').format('YYYY-MM-DDTHH:mm')
    const idx = hourlyForecast.findIndex((f) => f.time >= nowLocal)
    return idx === -1 ? 0 : idx
  }, [hourlyForecast, locationTimezone, nowMinute])

  // Forecast starting from the current hour
  const forecastFromNow = useMemo(
    () => hourlyForecast.slice(nowForecastIndex, nowForecastIndex + MAX_HOURS),
    [hourlyForecast, nowForecastIndex]
  )

  // Derive display weather based on selected time
  const displayWeather = useMemo<CurrentWeather | null>(() => {
    if (!currentWeather) return null
    if (selectedHourIndex === 0) return currentWeather
    const slot = forecastFromNow[selectedHourIndex]
    if (!slot) return currentWeather
    return forecastToCurrentWeather(slot, currentWeather)
  }, [currentWeather, forecastFromNow, selectedHourIndex])

  // Derive effective altitude wind for selected time
  const effectiveAltitudeWind = useMemo<number | undefined>(() => {
    if (!altitudeWindProfile || !currentWeather) return undefined
    if (selectedHourIndex === 0) return altitudeWindProfile.atFlightAltitude.windSpeed
    const slot = forecastFromNow[selectedHourIndex]
    if (!slot) return altitudeWindProfile.atFlightAltitude.windSpeed
    return scaledAltitudeWind(
      currentWeather.windSpeed,
      slot.windSpeed,
      altitudeWindProfile.atFlightAltitude.windSpeed
    )
  }, [altitudeWindProfile, currentWeather, forecastFromNow, selectedHourIndex])

  // Temperature at flight altitude using standard lapse rate (-6.5°C / 1000m)
  const altitudeTemperature = useMemo<number | null>(() => {
    if (!displayWeather || !effectiveAltitudeWind) return null
    return Math.round((displayWeather.temperature - aglHeight * LAPSE_RATE) * 10) / 10
  }, [displayWeather, effectiveAltitudeWind, aglHeight])

  // Compute per-hour statuses for the timeline bar
  // Each hour uses its own forecast Kp (3-hour resolution) to avoid all-red from current Kp
  const hourStatuses = useMemo<FlightStatus[]>(() => {
    if (!currentWeather) return []
    return forecastFromNow.map((slot, i) => {
      const weather = i === 0 ? currentWeather : forecastToCurrentWeather(slot, currentWeather)
      const altWind = i === 0
        ? altitudeWindProfile?.atFlightAltitude.windSpeed
        : altitudeWindProfile
          ? scaledAltitudeWind(currentWeather.windSpeed, slot.windSpeed, altitudeWindProfile.atFlightAltitude.windSpeed)
          : undefined
      const slotTemp = weather.temperature - aglHeight * LAPSE_RATE
      const weatherAtAlt = altWind != null ? { ...weather, temperature: slotTemp, feelsLike: slotTemp } : weather
      // Use per-slot Kp forecast so timeline colours reflect actual future conditions
      const slotKp = i === 0 || !kpData
        ? kpData
        : getEffectiveKp(kpData, slot.time, locationTimezone)
      return computeFlightScore(weatherAtAlt, selectedDrone, slotKp, altWind, terrainElevation + aglHeight).overall
    })
  }, [currentWeather, forecastFromNow, selectedDrone, kpData, altitudeWindProfile, aglHeight, terrainElevation])

  // Effective Kp for the selected time (forecast-aware)
  const effectiveKpData = useMemo(() => {
    if (!kpData) return null
    if (selectedHourIndex === 0) return kpData
    const slot = forecastFromNow[selectedHourIndex]
    if (!slot || !kpData.forecast.length) return kpData
    return getEffectiveKp(kpData, slot.time, locationTimezone)
  }, [kpData, selectedHourIndex, forecastFromNow, locationTimezone])

  const weatherForScore = displayWeather && altitudeTemperature != null
    ? { ...displayWeather, temperature: altitudeTemperature, feelsLike: altitudeTemperature }
    : displayWeather

  const flightScore = weatherForScore
    ? computeFlightScore(weatherForScore, selectedDrone, effectiveKpData, effectiveAltitudeWind, terrainElevation + aglHeight)
    : null

  const [chartCollapsed, setChartCollapsed] = useState(false)

  if (isMobile) {
    return (
      <MobileLayout
        location={location}
        displayWeather={displayWeather}
        flightScore={flightScore}
        hourlyForecast={forecastFromNow}
        hourStatuses={hourStatuses}
        selectedDrone={selectedDrone}
        selectedHourIndex={selectedHourIndex}
        altitudeProfile={altitudeWindProfile}
        effectiveAltitudeWind={effectiveAltitudeWind}
        altitudeTemperature={altitudeTemperature ?? undefined}
        isLoadingWeather={isLoadingWeather}
        error={error}
        kpData={effectiveKpData}
      />
    )
  }

  return (
    <div className="flex flex-col h-screen bg-dark-900 text-white overflow-hidden">
      <Header />

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <div className="w-[350px] flex-shrink-0 flex flex-col border-r border-dark-600 overflow-y-auto">
          <div className="p-4 space-y-3 border-b border-dark-600">
            <SearchBar />
            <LocateButton />
            <DroneSelector />
          </div>

          {/* Location info */}
          {location && (
            <div className="px-4 py-3 border-b border-dark-600 flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-accent-blue flex-shrink-0" />
              <span className="text-sm text-slate-300 truncate">{location.name}</span>
              <span className="text-xs text-slate-500 ml-auto flex-shrink-0">
                {location.lat.toFixed(4)}, {location.lon.toFixed(4)}
              </span>
            </div>
          )}

          {/* Data panels */}
          <div className="flex-1 p-4 space-y-4">

            {error && (
              <div className="flex items-start gap-3 bg-accent-red/10 border border-accent-red/30 rounded-xl p-4">
                <AlertCircle className="w-4 h-4 text-accent-red flex-shrink-0 mt-0.5" />
                <div className="text-sm text-accent-red">{error}</div>
              </div>
            )}

            {isLoadingWeather && (
              <div className="flex items-center justify-center gap-3 py-8">
                <Loader2 className="w-5 h-5 text-accent-blue animate-spin" />
                <span className="text-sm text-slate-400">載入天氣資料中...</span>
              </div>
            )}

            {!location && !isLoadingWeather && <EmptyState />}

            {/* Time slider */}
            {forecastFromNow.length > 0 && hourStatuses.length > 0 && (
              <TimeSlider maxHours={MAX_HOURS} hourStatuses={hourStatuses} forecastFromNow={forecastFromNow} />
            )}

            {flightScore && (
              <FlightScoreCard
                score={flightScore}
                droneName={`${selectedDrone.brand} ${selectedDrone.name}`}
                isForecast={selectedHourIndex > 0}
              />
            )}

            {displayWeather && <AltitudeInput />}

            {displayWeather && (
              <WeatherPanel
                weather={displayWeather}
                altitudeProfile={
                  selectedHourIndex === 0 ? altitudeWindProfile : null
                }
                effectiveAltitudeWind={
                  selectedHourIndex > 0 ? effectiveAltitudeWind : undefined
                }
                altitudeTemperature={altitudeTemperature ?? undefined}
              />
            )}

            {effectiveKpData && <KpIndexCard kp={effectiveKpData} isForecast={selectedHourIndex > 0} />}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Map */}
          <div className="flex-1 p-4 min-h-0">
            <MapView />
          </div>

          {/* Forecast chart */}
          {forecastFromNow.length > 0 && (
            <div className="flex-shrink-0 border-t border-dark-600">
              {/* Handle bar */}
              <button
                onClick={() => setChartCollapsed((v) => !v)}
                className="w-full flex items-center gap-3 px-6 py-1.5 bg-dark-800 hover:bg-dark-700 transition-colors group select-none cursor-pointer"
              >
                <div className="flex-1 h-px bg-dark-600 group-hover:bg-dark-500 transition-colors" />
                <div className="flex items-center gap-1.5 text-slate-500 group-hover:text-slate-300 transition-colors">
                  <BarChart2 className="w-3 h-3" />
                  <span className="text-xs font-medium tracking-wide">24 小時預報</span>
                  <ChevronDown className={`w-3 h-3 transition-transform duration-300 ${chartCollapsed ? '-rotate-180' : 'rotate-0'}`} />
                </div>
                <div className="flex-1 h-px bg-dark-600 group-hover:bg-dark-500 transition-colors" />
              </button>
              {/* Chart body */}
              <div className={`overflow-hidden transition-all duration-300 ease-in-out ${chartCollapsed ? 'h-0' : 'h-64'}`}>
                <div className="px-4 pb-4 h-64">
                  <ForecastChart
                    forecast={forecastFromNow}
                    drone={selectedDrone}
                    selectedHourIndex={selectedHourIndex}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Refresh indicator */}
          {location && currentWeather && (
            <div className="px-4 pb-3 flex items-center gap-1.5 text-xs text-slate-600">
              <RefreshCw className="w-3 h-3" />
              <span>更新於 {currentWeather.updatedAt}</span>
            </div>
          )}
        </div>
      </div>

      {/* Credit */}
      <div className="fixed bottom-3 right-4 z-[1002]">
        <CreditCard />
      </div>
    </div>
  )
}
