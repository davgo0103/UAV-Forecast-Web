import { Mountain } from 'lucide-react'
import { useStore } from '../store/useStore'
import { hapticTick, hapticBump } from '../utils/haptics'

export default function AltitudeInput() {
  const { aglHeight, setAglHeight, terrainElevation } = useStore()
  const totalMSL = terrainElevation + aglHeight

  return (
    <div className="bg-dark-700 border border-dark-600 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Mountain className="w-4 h-4 text-accent-cyan" />
        <span className="text-sm font-medium text-white">飛行高度設定</span>
      </div>

      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-xs text-slate-400 mb-1.5">
            <span>離地高度 (AGL)</span>
            <span className="text-white font-mono">{aglHeight} m</span>
          </div>
          <input
            type="range"
            min={1}
            max={1000}
            step={1}
            value={aglHeight}
            onChange={(e) => {
              const v = parseInt(e.target.value)
              setAglHeight(v)
              v === 1 || v === 1000 ? hapticBump() : hapticTick()
            }}
            className="w-full h-1.5 rounded-full appearance-none bg-dark-500 accent-accent-blue cursor-pointer"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>1m</span>
            <span>1000m</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-dark-600 rounded-lg p-2">
            <div className="text-xs text-slate-400">地形海拔</div>
            <div className="text-sm font-mono text-accent-cyan mt-0.5">{terrainElevation} m</div>
          </div>
          <div className="bg-dark-600 rounded-lg p-2">
            <div className="text-xs text-slate-400">飛行離地</div>
            <div className="text-sm font-mono text-white mt-0.5">{aglHeight} m</div>
          </div>
          <div className="bg-dark-600 rounded-lg p-2 border border-accent-blue/30">
            <div className="text-xs text-slate-400">實際海拔</div>
            <div className="text-sm font-mono text-accent-blue mt-0.5">{totalMSL} m</div>
          </div>
        </div>

        {terrainElevation > 1000 && (
          <div className="flex items-start gap-2 text-xs text-amber-400 bg-amber-400/10 rounded-lg p-2.5">
            <span className="text-amber-400 mt-0.5">⚠</span>
            <span>高海拔地區：空氣密度低，電池效率下降，實際飛行時間可能縮短 10-20%</span>
          </div>
        )}
      </div>
    </div>
  )
}
