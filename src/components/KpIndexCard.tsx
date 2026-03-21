import { Zap, Clock } from 'lucide-react'
import dayjs from 'dayjs'
import { KpData } from '../types'
import { useStore } from '../store/useStore'

interface Props {
  kp: KpData
  isForecast?: boolean
}

const STATUS_MAP = {
  quiet: { label: '平靜', color: 'text-accent-green', bg: 'bg-accent-green/10' },
  unsettled: { label: '輕微擾動', color: 'text-accent-cyan', bg: 'bg-accent-cyan/10' },
  active: { label: '活躍', color: 'text-accent-yellow', bg: 'bg-accent-yellow/10' },
  minor_storm: { label: '輕度地磁暴', color: 'text-accent-orange', bg: 'bg-accent-orange/10' },
  major_storm: { label: '強地磁暴', color: 'text-accent-red', bg: 'bg-accent-red/10' },
}

const GPS_MAP = {
  none: { label: '無影響', color: 'text-accent-green' },
  minor: { label: '輕微影響', color: 'text-accent-yellow' },
  moderate: { label: '中度影響', color: 'text-accent-orange' },
  severe: { label: '嚴重影響', color: 'text-accent-red' },
}

export default function KpIndexCard({ kp, isForecast }: Props) {
  const locationTimezone = useStore((s) => s.locationTimezone)
  const statusInfo = STATUS_MAP[kp.status]
  const gpsInfo = GPS_MAP[kp.gpsImpact]

  const kpColor = kp.current < 3 ? 'text-accent-green'
    : kp.current < 5 ? 'text-accent-yellow'
    : 'text-accent-red'

  return (
    <div className="bg-dark-700 border border-dark-600 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Zap className="w-4 h-4 text-accent-yellow" />
        <span className="text-sm font-medium text-white">地磁活動 / Kp 指數</span>
        {isForecast && (
          <span className="ml-auto flex items-center gap-1 text-xs text-accent-cyan">
            <Clock className="w-3 h-3" />
            預報
          </span>
        )}
      </div>

      <div className="flex items-center gap-4 mb-3">
        <div>
          <div className={`text-4xl font-black ${kpColor}`}>{kp.current.toFixed(1)}</div>
          <div className="text-xs text-slate-400 mt-0.5">Kp Index</div>
        </div>
        <div className="flex-1">
          <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.color}`}>
            {statusInfo.label}
          </div>
          <div className="mt-1.5 text-xs text-slate-400">
            GPS 精度影響：<span className={gpsInfo.color}>{gpsInfo.label}</span>
          </div>
        </div>
      </div>

      {/* Kp scale */}
      <div className="mb-3">
        <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((level) => (
            <div
              key={level}
              className={`flex-1 rounded-sm transition-all ${
                level < kp.current
                  ? level < 3 ? 'bg-accent-green'
                    : level < 5 ? 'bg-accent-yellow'
                    : 'bg-accent-red'
                  : 'bg-dark-500'
              }`}
            />
          ))}
        </div>
        <div className="flex justify-between text-xs text-slate-500 mt-1">
          <span>0 平靜</span>
          <span>5 地磁暴</span>
          <span>9 極端</span>
        </div>
      </div>

      {/* Forecast */}
      {kp.forecast.length > 0 && (
        <div>
          <div className="text-xs text-slate-400 mb-1.5">未來預報（每格 3 小時）</div>
          <div className="flex gap-1 overflow-x-auto pb-1">
            {kp.forecast.slice(0, 8).map((f, i) => {
              // NOAA times are UTC, convert to Taipei
              const label = dayjs.utc(f.time).tz(locationTimezone).format('MM/DD HH:mm')
              return (
                <div key={i} className="flex-shrink-0 text-center group relative">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold mb-0.5 cursor-default transition-opacity group-hover:opacity-80 ${
                      f.kp < 3 ? 'bg-accent-green/20 text-accent-green'
                      : f.kp < 5 ? 'bg-accent-yellow/20 text-accent-yellow'
                      : 'bg-accent-red/20 text-accent-red'
                    }`}
                  >
                    {f.kp.toFixed(0)}
                  </div>
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-10 pointer-events-none">
                    <div className="bg-dark-600 border border-dark-500 rounded-lg px-2 py-1.5 text-xs text-white whitespace-nowrap shadow-xl">
                      <div className="font-mono">{label}</div>
                      <div className="text-slate-400 mt-0.5">Kp = {f.kp.toFixed(1)}</div>
                    </div>
                    <div className="w-2 h-2 bg-dark-600 border-r border-b border-dark-500 rotate-45 mx-auto -mt-1" />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
