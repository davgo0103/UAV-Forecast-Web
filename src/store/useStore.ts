import { create } from 'zustand'
import { Location, DroneSpec, CurrentWeather, HourlyForecast, KpData, AltitudeWindProfile } from '../types'
import { DRONE_PRESETS } from '../data/drones'

interface AppState {
  // Location
  location: Location | null
  setLocation: (loc: Location) => void

  // Drone
  selectedDrone: DroneSpec
  setSelectedDrone: (drone: DroneSpec) => void
  customDrones: DroneSpec[]
  addCustomDrone: (drone: DroneSpec) => void

  // Flight altitude
  aglHeight: number // meters above ground level
  setAglHeight: (h: number) => void

  // Weather data
  currentWeather: CurrentWeather | null
  hourlyForecast: HourlyForecast[]
  kpData: KpData | null
  altitudeWindProfile: AltitudeWindProfile | null
  terrainElevation: number

  setCurrentWeather: (w: CurrentWeather) => void
  setHourlyForecast: (f: HourlyForecast[]) => void
  setKpData: (kp: KpData) => void
  setAltitudeWindProfile: (p: AltitudeWindProfile) => void
  setTerrainElevation: (e: number) => void
  clearWeather: () => void

  // Timezone of the selected location (IANA, e.g. 'Asia/Taipei')
  locationTimezone: string
  setLocationTimezone: (tz: string) => void

  // Time selection (0 = now, 1-47 = future hours)
  selectedHourIndex: number
  setSelectedHourIndex: (i: number) => void

  // Weather model
  weatherModel: string | null
  setWeatherModel: (m: string) => void

  // Degraded-data warnings (shown when using fallback API)
  dataWarnings: string[]
  setDataWarnings: (w: string[]) => void

  // OpenSky remaining credits
  openskyCredits: number | null
  setOpenskyCredits: (v: number | null) => void

  // Loading states
  isLoadingWeather: boolean
  isLoadingKp: boolean
  setIsLoadingWeather: (v: boolean) => void
  setIsLoadingKp: (v: boolean) => void

  // Error
  error: string | null
  setError: (e: string | null) => void
}

export const useStore = create<AppState>((set) => ({
  location: null,
  setLocation: (loc) => set({ location: loc }),

  selectedDrone: DRONE_PRESETS[0],
  setSelectedDrone: (drone) => set({ selectedDrone: drone }),
  customDrones: [],
  addCustomDrone: (drone) =>
    set((state) => ({ customDrones: [...state.customDrones, drone] })),

  aglHeight: 60,
  setAglHeight: (h) => set({ aglHeight: h }),

  currentWeather: null,
  hourlyForecast: [],
  kpData: null,
  altitudeWindProfile: null,
  terrainElevation: 0,

  setCurrentWeather: (w) => set({ currentWeather: w }),
  setHourlyForecast: (f) => set({ hourlyForecast: f }),
  setKpData: (kp) => set({ kpData: kp }),
  setAltitudeWindProfile: (p) => set({ altitudeWindProfile: p }),
  setTerrainElevation: (e) => set({ terrainElevation: e }),
  clearWeather: () => set({
    currentWeather: null,
    hourlyForecast: [],
    altitudeWindProfile: null,
    terrainElevation: 0,
    selectedHourIndex: 0,
  }),

  locationTimezone: 'Asia/Taipei',
  setLocationTimezone: (tz) => set({ locationTimezone: tz }),

  selectedHourIndex: 0,
  setSelectedHourIndex: (i) => set({ selectedHourIndex: i }),

  weatherModel: null,
  setWeatherModel: (m) => set({ weatherModel: m }),

  dataWarnings: [],
  setDataWarnings: (w) => set({ dataWarnings: w }),

  openskyCredits: null,
  setOpenskyCredits: (v) => set({ openskyCredits: v }),

  isLoadingWeather: false,
  isLoadingKp: false,
  setIsLoadingWeather: (v) => set({ isLoadingWeather: v }),
  setIsLoadingKp: (v) => set({ isLoadingKp: v }),

  error: null,
  setError: (e) => set({ error: e }),
}))
