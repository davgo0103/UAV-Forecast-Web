import { useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Plus } from 'lucide-react'
import { DRONE_PRESETS } from '../data/drones'
import { useStore } from '../store/useStore'
import { DroneSpec } from '../types'

export default function DroneSelector() {
  const { selectedDrone, setSelectedDrone, customDrones, addCustomDrone } = useStore()
  const [open, setOpen] = useState(false)
  const [showCustomForm, setShowCustomForm] = useState(false)
  const [form, setForm] = useState<Partial<DroneSpec>>({
    name: '',
    brand: '',
    maxWindSpeed: 10,
    minTemp: -10,
    maxTemp: 40,
    maxAltitude: 4000,
    minVisibility: 500,
    ipRating: '',
    rainResistance: 'none',
  })

  const allDrones = [...DRONE_PRESETS.filter((d) => !d.isCustom), ...customDrones]

  function handleAddCustom() {
    if (!form.name || !form.brand) return
    const drone: DroneSpec = {
      id: `custom-${Date.now()}`,
      name: form.name!,
      brand: form.brand!,
      maxWindSpeed: form.maxWindSpeed ?? 10,
      maxWindSpeedBeaufort: 5,
      minTemp: form.minTemp ?? -10,
      maxTemp: form.maxTemp ?? 40,
      maxAltitude: form.maxAltitude ?? 4000,
      minVisibility: form.minVisibility ?? 500,
      ipRating: form.ipRating ?? '',
      rainResistance: form.rainResistance ?? 'none',
      isCustom: true,
    }
    addCustomDrone(drone)
    setSelectedDrone(drone)
    setShowCustomForm(false)
    setOpen(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between bg-dark-600 border border-dark-500 rounded-lg px-3 py-2 text-sm text-white hover:border-accent-blue/50 transition-colors"
      >
        <div className="text-left">
          <div className="font-medium">{selectedDrone.brand} {selectedDrone.name}</div>
          <div className="text-xs text-slate-400">
            最大耐風 {selectedDrone.maxWindSpeed} m/s · {selectedDrone.minTemp}°C ~ {selectedDrone.maxTemp}°C
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-dark-700 border border-dark-500 rounded-lg shadow-xl z-40 overflow-hidden">
          {allDrones.map((drone) => (
            <button
              key={drone.id}
              onClick={() => { setSelectedDrone(drone); setOpen(false) }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors border-b border-dark-600 last:border-0
                ${selectedDrone.id === drone.id ? 'bg-accent-blue/10 text-accent-blue' : 'text-slate-300 hover:bg-dark-600 hover:text-white'}`}
            >
              <div className="font-medium">{drone.brand} {drone.name}</div>
              <div className="text-xs text-slate-500">
                耐風 {drone.maxWindSpeed} m/s · {drone.minTemp}~{drone.maxTemp}°C
                {drone.ipRating ? ` · ${drone.ipRating}` : ''}
              </div>
            </button>
          ))}
          <button
            onClick={() => setShowCustomForm(true)}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-accent-cyan hover:bg-dark-600 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            新增自訂機型
          </button>
        </div>
      )}

      {showCustomForm && createPortal(
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4">
          <div className="bg-dark-700 border border-dark-500 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-white font-semibold mb-4">新增自訂機型</h3>
            <div className="space-y-3">
              {[
                { label: '品牌', key: 'brand', type: 'text' },
                { label: '型號', key: 'name', type: 'text' },
                { label: '最大耐風 (m/s)', key: 'maxWindSpeed', type: 'number' },
                { label: '最低溫度 (°C)', key: 'minTemp', type: 'number' },
                { label: '最高溫度 (°C)', key: 'maxTemp', type: 'number' },
                { label: '最大高度 (m)', key: 'maxAltitude', type: 'number' },
                { label: '最低能見度 (m)', key: 'minVisibility', type: 'number' },
              ].map(({ label, key, type }) => (
                <div key={key}>
                  <label className="text-xs text-slate-400 mb-1 block">{label}</label>
                  <input
                    type={type}
                    value={(form as Record<string, unknown>)[key] as string ?? ''}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        [key]: type === 'number' ? parseFloat(e.target.value) : e.target.value,
                      }))
                    }
                    className="w-full bg-dark-600 border border-dark-500 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-accent-blue"
                  />
                </div>
              ))}
              <div>
                <label className="text-xs text-slate-400 mb-1 block">防水等級</label>
                <select
                  value={form.rainResistance ?? 'none'}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, rainResistance: e.target.value as DroneSpec['rainResistance'] }))
                  }
                  className="w-full bg-dark-600 border border-dark-500 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-accent-blue"
                >
                  <option value="none">無防水</option>
                  <option value="light">防潑水</option>
                  <option value="moderate">防雨</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowCustomForm(false)}
                className="flex-1 py-2 rounded-lg border border-dark-500 text-slate-400 text-sm hover:text-white hover:border-slate-500 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleAddCustom}
                className="flex-1 py-2 rounded-lg bg-accent-blue text-white text-sm font-medium hover:bg-blue-500 transition-colors"
              >
                新增
              </button>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  )
}
