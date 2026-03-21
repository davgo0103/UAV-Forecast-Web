import { Wind } from 'lucide-react'

export default function Header() {
  return (
    <header className="flex items-center gap-3 px-6 py-4 border-b border-dark-600 bg-dark-800">
      <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-accent-blue/20">
        <Wind className="w-5 h-5 text-accent-blue" />
      </div>
      <div>
        <h1 className="text-lg font-bold text-white tracking-wide">UAV Forecast Taiwan</h1>
        <p className="text-xs text-slate-400">台灣無人機氣象預報</p>
      </div>
    </header>
  )
}
