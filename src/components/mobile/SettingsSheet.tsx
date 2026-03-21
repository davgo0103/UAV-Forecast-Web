import { createPortal } from 'react-dom'
import { X, Settings2 } from 'lucide-react'
import DroneSelector from '../DroneSelector'
import AltitudeInput from '../AltitudeInput'

interface Props {
  onClose: () => void
}

export default function SettingsSheet({ onClose }: Props) {
  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[9998] bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[9999] bg-dark-800/60 backdrop-blur-xl rounded-t-2xl border-t border-dark-600/60 flex flex-col"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-dark-500" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-dark-600">
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-accent-blue" />
            <span className="text-white font-semibold text-sm">飛行設定</span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-dark-600 text-slate-400 active:bg-dark-500"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-4 space-y-4 overflow-y-auto max-h-[60dvh]">
          <div>
            <p className="text-xs text-slate-400 mb-2">機型選擇</p>
            <DroneSelector />
          </div>
          <AltitudeInput />
        </div>
      </div>
    </>,
    document.body
  )
}
