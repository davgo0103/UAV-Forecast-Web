import { CheckCircle, AlertTriangle, XCircle, Shield, Clock } from 'lucide-react'
import { FlightScore, FlightStatus } from '../types'

interface Props {
  score: FlightScore
  droneName: string
  isForecast?: boolean
}

function StatusIcon({ status, size = 'sm' }: { status: FlightStatus; size?: 'sm' | 'lg' }) {
  const cls = size === 'lg' ? 'w-8 h-8' : 'w-4 h-4'
  if (status === 'good') return <CheckCircle className={`${cls} text-accent-green`} />
  if (status === 'caution') return <AlertTriangle className={`${cls} text-accent-yellow`} />
  return <XCircle className={`${cls} text-accent-red`} />
}

function statusColor(status: FlightStatus) {
  if (status === 'good') return 'text-accent-green'
  if (status === 'caution') return 'text-accent-yellow'
  return 'text-accent-red'
}

function statusBg(status: FlightStatus) {
  if (status === 'good') return 'bg-accent-green/10 border-accent-green/30'
  if (status === 'caution') return 'bg-accent-yellow/10 border-accent-yellow/30'
  return 'bg-accent-red/10 border-accent-red/30'
}

function statusLabel(status: FlightStatus, score: number) {
  if (score < 40) return '飛了就炸'
  if (score < 70) return '禁飛'
  if (status === 'good') return '適合飛行'
  if (status === 'caution') return '謹慎飛行'
  return '不建議飛行'
}

export default function FlightScoreCard({ score, droneName, isForecast }: Props) {
  return (
    <div className="bg-dark-700 border border-dark-600 rounded-xl overflow-hidden">
      {/* Overall */}
      <div className={`flex items-center gap-4 p-4 border-b ${statusBg(score.overall)}`}>
        <StatusIcon status={score.overall} size="lg" />
        <div className="flex-1">
          <div className={`text-xl font-bold ${statusColor(score.overall)}`}>
            {statusLabel(score.overall, score.score)}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
            {isForecast && <Clock className="w-3 h-3 text-accent-cyan" />}
            <span>{droneName} · {isForecast ? '預報評估' : '當前評估'}</span>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-3xl font-black ${statusColor(score.overall)}`}>{score.score}</div>
          <div className="text-xs text-slate-500">/ 100</div>
        </div>
      </div>

      {/* Score bar */}
      <div className="px-4 pt-3 pb-1">
        <div className="h-1.5 bg-dark-500 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              score.overall === 'good' ? 'bg-accent-green' :
              score.overall === 'caution' ? 'bg-accent-yellow' : 'bg-accent-red'
            }`}
            style={{ width: `${score.score}%` }}
          />
        </div>
      </div>

      {/* Items */}
      <div className="p-4 space-y-2">
        {score.items.map((item, i) => (
          <div key={i} className="flex items-start gap-3">
            <StatusIcon status={item.status} />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-xs text-slate-400">{item.label}</span>
                <span className="text-sm font-mono font-medium text-white">
                  {item.value}{item.unit && <span className="text-xs text-slate-400 ml-0.5">{item.unit}</span>}
                </span>
              </div>
              {item.reason && (
                <div className={`text-xs mt-0.5 ${statusColor(item.status)}`}>{item.reason}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 pb-3 flex items-center gap-1.5 text-xs text-slate-500">
        <Shield className="w-3 h-3" />
        <span>評估結果僅供參考，飛行前請確認當地法規</span>
      </div>
    </div>
  )
}
