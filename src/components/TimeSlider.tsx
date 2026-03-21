import { useRef } from 'react'
import { Clock } from 'lucide-react'
import dayjs from 'dayjs'
import { useStore } from '../store/useStore'
import { FlightStatus, HourlyForecast } from '../types'

interface Props {
  maxHours: number
  hourStatuses: FlightStatus[]
  forecastFromNow: HourlyForecast[]
}

const STATUS_COLOR: Record<FlightStatus, string> = {
  good: 'bg-accent-green',
  caution: 'bg-accent-yellow',
  danger: 'bg-accent-red',
}

const STATUS_GLOW: Record<FlightStatus, string> = {
  good: 'shadow-[0_0_8px_theme(colors.accent.green)]',
  caution: 'shadow-[0_0_8px_theme(colors.accent.yellow)]',
  danger: 'shadow-[0_0_8px_theme(colors.accent.red)]',
}

export default function TimeSlider({ maxHours, hourStatuses, forecastFromNow }: Props) {
  const { selectedHourIndex, setSelectedHourIndex } = useStore()
  const trackRef = useRef<HTMLDivElement>(null)

  function indexFromClientX(clientX: number): number {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect) return selectedHourIndex
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return Math.round(ratio * (maxHours - 1))
  }

  function handleTouchStart(e: React.TouchEvent) {
    e.preventDefault()
    setSelectedHourIndex(indexFromClientX(e.touches[0].clientX))
  }

  function handleTouchMove(e: React.TouchEvent) {
    e.preventDefault()
    setSelectedHourIndex(indexFromClientX(e.touches[0].clientX))
  }

  const selectedTime = forecastFromNow[selectedHourIndex]
  const isNow = selectedHourIndex === 0
  const timeLabel = selectedTime
    ? isNow
      ? '現在'
      : dayjs(selectedTime.time).format('MM/DD HH:mm')
    : '現在'

  const currentStatus = hourStatuses[selectedHourIndex] ?? 'good'

  return (
    <div className="bg-dark-700 border border-dark-600 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-accent-blue" />
          <span className="text-sm font-medium text-white">時間預報</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${STATUS_COLOR[currentStatus]} ${STATUS_GLOW[currentStatus]}`} />
          <span className="text-sm font-mono font-semibold text-white">{timeLabel}</span>
          {!isNow && (
            <button
              onClick={() => setSelectedHourIndex(0)}
              className="text-xs text-accent-blue hover:text-blue-300 transition-colors ml-1"
            >
              回到現在
            </button>
          )}
        </div>
      </div>

      {/* Timeline dots */}
      <div
        ref={trackRef}
        className="relative mb-2 py-3 -my-3 cursor-pointer"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
      >
        <div className="flex gap-px h-4 items-center pointer-events-none">
          {hourStatuses.slice(0, maxHours).map((status, i) => (
            <div
              key={i}
              className={`flex-1 h-1.5 rounded-sm transition-all
                ${STATUS_COLOR[status]}
                ${i === selectedHourIndex ? 'opacity-100 h-3' : 'opacity-50'}`}
            />
          ))}
        </div>
        {/* Desktop slider */}
        <input
          type="range"
          min={0}
          max={maxHours - 1}
          value={selectedHourIndex}
          onChange={(e) => setSelectedHourIndex(parseInt(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer touch-none"
          style={{ height: '100%' }}
        />
      </div>

      <div className="flex justify-between text-xs text-slate-500">
        <span>現在</span>
        <span>+12h</span>
        <span>+24h</span>
        <span>+36h</span>
        <span>+{maxHours}h</span>
      </div>

      {/* Hour markers every 6h */}
      {!isNow && selectedTime && (
        <div className="mt-3 pt-3 border-t border-dark-600 grid grid-cols-3 gap-2 text-center">
          <div className="bg-dark-600 rounded-lg p-2">
            <div className="text-xs text-slate-400">風速</div>
            <div className="text-sm font-mono text-white">{selectedTime.windSpeed} <span className="text-xs text-slate-400">m/s</span></div>
          </div>
          <div className="bg-dark-600 rounded-lg p-2">
            <div className="text-xs text-slate-400">溫度</div>
            <div className="text-sm font-mono text-white">{selectedTime.temperature}°C</div>
          </div>
          <div className="bg-dark-600 rounded-lg p-2">
            <div className="text-xs text-slate-400">降水率</div>
            <div className="text-sm font-mono text-white">{selectedTime.precipitationProbability}%</div>
          </div>
        </div>
      )}
    </div>
  )
}
