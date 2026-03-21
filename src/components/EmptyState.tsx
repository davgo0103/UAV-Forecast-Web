import { MapPin } from 'lucide-react'

export default function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8 gap-4">
      <div className="w-16 h-16 rounded-2xl bg-dark-600 flex items-center justify-center">
        <MapPin className="w-8 h-8 text-slate-500" />
      </div>
      <div>
        <div className="text-white font-semibold text-lg">選擇飛行地點</div>
        <div className="text-slate-500 text-sm mt-1.5 leading-relaxed">
          在地圖上點選位置<br />或使用搜尋框輸入地名
        </div>
      </div>
    </div>
  )
}
