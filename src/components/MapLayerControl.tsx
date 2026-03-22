import { useState } from 'react'
import { Layers, CloudRain, Cloud, Wind, PlaneTakeoff, Trees, Loader2 } from 'lucide-react'
import { LayerState } from './MapOverlayLayers'

export type BaseMapKey = 'dark' | 'satellite' | 'terrain' | 'hiking'

interface Props {
  baseMap: BaseMapKey
  onBaseMapChange: (map: BaseMapKey) => void
  layers: LayerState
  onLayerToggle: (key: keyof LayerState) => void
  /** null = validating, true = valid, false = invalid/no key */
  owmValid: null | boolean
}

const BASE_MAP_OPTIONS: { key: BaseMapKey; label: string }[] = [
  { key: 'dark', label: '深色' },
  { key: 'satellite', label: '衛星' },
  { key: 'terrain', label: '地形' },
  { key: 'hiking', label: '山岳' },
]

const OVERLAY_OPTIONS: {
  key: keyof LayerState
  label: string
  Icon: React.ComponentType<{ className?: string }>
  needsOwm?: boolean
}[] = [
  { key: 'radar', label: '雷達回波', Icon: CloudRain },
  { key: 'clouds', label: '雲層', Icon: Cloud, needsOwm: true },
  { key: 'wind', label: '風場動畫', Icon: Wind },
  { key: 'airspace', label: '管制空域', Icon: PlaneTakeoff },
  { key: 'parks', label: '國家公園', Icon: Trees },
]

function OwmStatusBadge({ owmValid }: { owmValid: null | boolean }) {
  if (owmValid === null)
    return (
      <span className="flex items-center gap-1 text-xs text-slate-400">
        <Loader2 className="w-3 h-3 animate-spin" />
        驗證中
      </span>
    )
  if (owmValid === false)
    return (
      <span className="text-xs text-accent-red" title="API Key 無效或尚未激活（新 Key 最久需 2 小時）">
        ⚠ Key 無效
      </span>
    )
  return <span className="text-xs text-accent-green">✓ 已連線</span>
}

export default function MapLayerControl({
  baseMap,
  onBaseMapChange,
  layers,
  onLayerToggle,
  owmValid,
}: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        title="圖層控制"
        className={`flex items-center justify-center w-9 h-9 rounded-lg border shadow-xl transition-colors ${
          open
            ? 'bg-accent-blue border-accent-blue/60 text-white'
            : 'bg-dark-700/95 border-dark-500 text-slate-300 hover:bg-dark-600'
        }`}
      >
        <Layers className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute top-11 right-0 w-48 bg-dark-700/95 backdrop-blur-sm border border-dark-500 rounded-xl shadow-2xl p-3 space-y-3">
          {/* Base map selector */}
          <div>
            <div className="text-xs text-slate-400 mb-1.5 font-medium">底圖</div>
            <div className="grid grid-cols-2 gap-1">
              {BASE_MAP_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => onBaseMapChange(opt.key)}
                  className={`text-xs py-1.5 rounded-lg transition-colors ${
                    baseMap === opt.key
                      ? 'bg-accent-blue text-white font-medium'
                      : 'bg-dark-600 text-slate-400 hover:bg-dark-500'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-dark-500" />

          {/* Overlay toggles */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-slate-400 font-medium">圖層</span>
            </div>
            <div className="space-y-1">
              {OVERLAY_OPTIONS.map(({ key, label, Icon, needsOwm }) => {
                const owmUnavailable = !!(needsOwm && !owmValid)
                const owmChecking = !!(needsOwm && owmValid === null)
                const disabled = owmUnavailable && !owmChecking
                const active = layers[key]

                let title: string | undefined
                if (owmChecking) title = 'OWM 驗證中...'
                else if (owmUnavailable) title = 'OWM API Key 無效或尚未激活（新 Key 最久需 2 小時）'

                return (
                  <button
                    key={key}
                    onClick={() => !disabled && !owmChecking && onLayerToggle(key)}
                    disabled={disabled || owmChecking}
                    title={title}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                      disabled
                        ? 'opacity-40 cursor-not-allowed text-slate-500'
                        : owmChecking
                        ? 'opacity-60 cursor-wait text-slate-400'
                        : active
                        ? 'bg-accent-blue/20 text-accent-blue'
                        : 'text-slate-400 hover:bg-dark-600'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="flex-1 text-left">{label}</span>
                    {owmChecking ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : disabled ? (
                      <span className="text-xs">🔑</span>
                    ) : (
                      <span
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          active ? 'bg-accent-blue' : 'bg-dark-400'
                        }`}
                      />
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* OWM status */}
          <div className="border-t border-dark-500 pt-2 flex items-center justify-between">
            <span className="text-xs text-slate-600">OWM</span>
            <OwmStatusBadge owmValid={owmValid} />
          </div>

          <p className="text-xs text-slate-600">空域資料僅供參考</p>
        </div>
      )}
    </div>
  )
}
