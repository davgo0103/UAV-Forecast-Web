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
    setDataWarnings,
  } = useStore()

  useEffect(() => {
    if (!location) return

    let isFirstLoad = true
    let cancelled = false

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
        if (cancelled) return

        const roundedElev = Math.round(elevation)

        setLocationTimezone(timezone)
        setWeatherModel(model)

        const warnings: string[] = []
        if (model === 'WeatherAPI' || model === 'MET Norway') {
          warnings.push('高度風速以地面風推算（無壓力層資料）')
        }
        if (model === 'MET Norway') {
          warnings.push('能見度資料固定 10km')
          warnings.push('夜間飛行判斷不可用（無日出日落）')
        }
        setDataWarnings(warnings)
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
        if (cancelled) return
        const msg = e instanceof Error ? e.message : String(e)
        const reason: string = (e as { response?: { data?: { reason?: string } } })?.response?.data?.reason ?? ''
        if (reason.toLowerCase().includes('limit')) {
          const r = reason.toLowerCase()
          const resetHint = r.includes('minute') ? '請一分鐘後再試' : r.includes('hour') ? '請一小時後再試' : '請明天再試'
          setError(`天氣 API 已達請求上限，${resetHint}`)
        } else if (msg.includes('timeout') || msg.includes('ECONNABORTED')) {
          setError('請求逾時，請確認網路連線後再試')
        } else if (msg.includes('Network') || msg.includes('network')) {
          setError('網路連線失敗，請確認網路後再試')
        } else {
          setError('無法載入天氣資料，請稍後再試')
        }
        console.error('[useWeatherData]', e)
      } finally {
        if (!cancelled) setIsLoadingWeather(false)
      }
    }

    load()

    const id = setInterval(load, 30 * 60 * 1000)
    return () => { cancelled = true; clearInterval(id) }
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
