import { useEffect } from 'react'
import { useStore } from '../store/useStore'
import { fetchAllWeatherData, buildAltitudeWindProfile } from '../services/openMeteo'
import { fetchKpIndex } from '../services/noaa'

export function useWeatherData() {
  const {
    location,
    aglHeight,
    setCurrentWeather,
    setHourlyForecast,
    setAltitudeWindProfile,
    setTerrainElevation,
    setKpData,
    setIsLoadingWeather,
    setIsLoadingKp,
    setError,
    clearWeather,
    setLocationTimezone,
    setWeatherModel,
  } = useStore()

  useEffect(() => {
    if (!location) return

    let isFirstLoad = true

    async function load() {
      if (!location) return
      setIsLoadingWeather(true)
      setError(null)

      // Only clear stale data on location change — auto-refresh updates in place
      if (isFirstLoad) {
        clearWeather()
        isFirstLoad = false
      }

      try {
        // Single combined request — weather + hourly + pressure winds + elevation
        const { current, hourly, upperWinds, elevation, timezone, model } = await fetchAllWeatherData(
          location.lat,
          location.lon
        )

        const roundedElev = Math.round(elevation)

        setLocationTimezone(timezone)
        setWeatherModel(model)
        setCurrentWeather(current)
        setHourlyForecast(hourly)
        setTerrainElevation(roundedElev)

        // Build altitude wind profile — non-fatal if upperWinds is empty
        const profile = buildAltitudeWindProfile(
          upperWinds,
          { speed: current.windSpeed, direction: current.windDirection },
          roundedElev,
          aglHeight
        )
        setAltitudeWindProfile(profile)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        // Give a more specific error if possible
        if (msg.includes('timeout') || msg.includes('ECONNABORTED')) {
          setError('請求逾時，請確認網路連線後再試')
        } else if (msg.includes('Network') || msg.includes('network')) {
          setError('網路連線失敗，請確認網路後再試')
        } else {
          setError('無法載入天氣資料，請稍後再試')
        }
        console.error('[useWeatherData]', e)
      } finally {
        setIsLoadingWeather(false)
      }
    }

    load()

    // Auto-refresh every 30 minutes while page stays open
    const id = setInterval(load, 30 * 60 * 1000)
    return () => clearInterval(id)
  }, [location]) // eslint-disable-line react-hooks/exhaustive-deps

  // Recalculate altitude wind profile when AGL changes
  useEffect(() => {
    const state = useStore.getState()
    if (!state.currentWeather || !state.altitudeWindProfile) return

    const profile = buildAltitudeWindProfile(
      state.altitudeWindProfile.levels,
      { speed: state.currentWeather.windSpeed, direction: state.currentWeather.windDirection },
      state.terrainElevation,
      aglHeight
    )
    setAltitudeWindProfile(profile)
  }, [aglHeight]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch Kp index once on mount — non-fatal
  useEffect(() => {
    setIsLoadingKp(true)
    fetchKpIndex()
      .then(setKpData)
      .catch(() => { /* Kp is supplementary, silently skip */ })
      .finally(() => setIsLoadingKp(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}
