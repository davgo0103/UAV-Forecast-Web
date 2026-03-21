import { useState } from 'react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, BarChart, Bar, ReferenceLine
} from 'recharts'
import dayjs from 'dayjs'
import { HourlyForecast } from '../types'
import { DroneSpec } from '../types'

interface Props {
  forecast: HourlyForecast[]
  drone: DroneSpec
  selectedHourIndex?: number
}

type Tab = 'wind' | 'temp' | 'rain'

const TAB_LABELS: Record<Tab, string> = {
  wind: '風速',
  temp: '溫度',
  rain: '降水',
}

export default function ForecastChart({ forecast, drone, selectedHourIndex = 0 }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('wind')

  const selectedTime = forecast[selectedHourIndex]
    ? dayjs(forecast[selectedHourIndex].time).format('HH:mm')
    : null

  const data = forecast.slice(0, 24).map((f) => ({
    time: dayjs(f.time).format('HH:mm'),
    windSpeed: f.windSpeed,
    windGust: f.windGust,
    temperature: f.temperature,
    precipitation: f.precipitation,
    precipProbability: f.precipitationProbability,
  }))

  const tooltipStyle = {
    backgroundColor: '#141d35',
    border: '1px solid #1a2540',
    borderRadius: '8px',
    color: '#e2e8f0',
    fontSize: '12px',
  }

  return (
    <div className="bg-dark-700 border border-dark-600 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-white">24 小時預報</span>
        <div className="flex gap-1">
          {(Object.keys(TAB_LABELS) as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-accent-blue text-white'
                  : 'text-slate-400 hover:text-white hover:bg-dark-600'
              }`}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>
      </div>

      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          {activeTab === 'wind' ? (
            <AreaChart data={data}>
              <defs>
                <linearGradient id="windGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gustGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a2540" />
              <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} unit=" m/s" />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
              {/* Max wind reference line */}
              <Area
                type="monotone"
                dataKey="windGust"
                name="陣風"
                stroke="#f97316"
                fill="url(#gustGrad)"
                strokeWidth={1.5}
                dot={false}
              />
              <Area
                type="monotone"
                dataKey="windSpeed"
                name="風速"
                stroke="#3b82f6"
                fill="url(#windGrad)"
                strokeWidth={2}
                dot={false}
              />
              {/* Drone limit line via reference */}
              <Area
                type="monotone"
                dataKey={() => drone.maxWindSpeed}
                name={`${drone.name} 上限`}
                stroke="#ef4444"
                fill="none"
                strokeWidth={1}
                strokeDasharray="5 5"
                dot={false}
              />
              {selectedTime && selectedHourIndex < 24 && (
                <ReferenceLine x={selectedTime} stroke="#06b6d4" strokeWidth={1.5} strokeDasharray="4 3" label={{ value: '▼', fill: '#06b6d4', fontSize: 10, position: 'top' }} />
              )}
            </AreaChart>
          ) : activeTab === 'temp' ? (
            <AreaChart data={data}>
              <defs>
                <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a2540" />
              <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} unit="°C" />
              <Tooltip contentStyle={tooltipStyle} />
              <Area
                type="monotone"
                dataKey="temperature"
                name="溫度"
                stroke="#06b6d4"
                fill="url(#tempGrad)"
                strokeWidth={2}
                dot={false}
              />
              {selectedTime && selectedHourIndex < 24 && (
                <ReferenceLine x={selectedTime} stroke="#06b6d4" strokeWidth={1.5} strokeDasharray="4 3" label={{ value: '▼', fill: '#06b6d4', fontSize: 10, position: 'top' }} />
              )}
            </AreaChart>
          ) : (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a2540" />
              <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} unit=" mm" />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
              <Bar dataKey="precipitation" name="降水量" fill="#3b82f6" radius={[2, 2, 0, 0]} />
              <Bar dataKey="precipProbability" name="降水機率%" fill="#22c55e" radius={[2, 2, 0, 0]} opacity={0.7} />
              {selectedTime && selectedHourIndex < 24 && (
                <ReferenceLine x={selectedTime} stroke="#06b6d4" strokeWidth={1.5} strokeDasharray="4 3" label={{ value: '▼', fill: '#06b6d4', fontSize: 10, position: 'top' }} />
              )}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}
