import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, MapPin } from 'lucide-react'
import MapView from '../MapView'
import { useStore } from '../../store/useStore'
import { FlightStatus } from '../../types'

interface Props {
  visible: boolean
  onClose: () => void
  flightStatus?: FlightStatus
}

const STATUS_COLOR: Record<FlightStatus, string> = {
  good: 'bg-accent-green text-white',
  caution: 'bg-accent-yellow text-dark-900',
  danger: 'bg-accent-red text-white',
}
const STATUS_LABEL: Record<FlightStatus, string> = {
  good: '適合飛行',
  caution: '謹慎飛行',
  danger: '不建議飛行',
}

export default function MobileMapOverlay({ visible, onClose, flightStatus }: Props) {
  const location = useStore((s) => s.location)

  // When becoming visible, trigger a resize so Leaflet recalculates map dimensions
  useEffect(() => {
    if (visible) {
      setTimeout(() => window.dispatchEvent(new Event('resize')), 50)
    }
  }, [visible])

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex flex-col bg-dark-900"
      style={{ paddingTop: 'env(safe-area-inset-top)', display: visible ? undefined : 'none' }}
    >

      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 bg-dark-800/90 backdrop-blur-sm border-b border-dark-600">
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-dark-600 text-slate-300 active:bg-dark-500"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex-1 min-w-0">
          {location ? (
            <div className="flex items-center gap-1.5 text-sm text-white truncate">
              <MapPin className="w-3.5 h-3.5 text-accent-blue flex-shrink-0" />
              <span className="truncate">{location.name}</span>
            </div>
          ) : (
            <span className="text-sm text-slate-400">點選地圖選擇位置</span>
          )}
        </div>

        {flightStatus && (
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLOR[flightStatus]}`}>
            {STATUS_LABEL[flightStatus]}
          </span>
        )}
      </div>

      {/* Map fills remaining space */}
      <div className="flex-1 min-h-0">
        <MapView />
      </div>

      {/* Bottom hint */}
      <div
        className="text-center text-xs text-slate-500 py-2 bg-dark-800/80 backdrop-blur-sm"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 8px)' }}
      >
        點選地圖設定飛行地點
      </div>
    </div>,
    document.body
  )
}
