import { useState } from 'react'
import { X, Globe, Copy, Check, Coffee } from 'lucide-react'

export default function CreditCard() {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const binanceId = '62106627'

  function copyId() {
    navigator.clipboard.writeText(binanceId).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <>
      {/* Trigger */}
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-slate-700 hover:text-slate-400 transition-colors select-none whitespace-nowrap"
      >
        Crafted by 小蔡
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-[1010]"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Card */}
      {open && (
        <div className="fixed bottom-10 right-4 z-[1011] w-64 bg-dark-800/90 backdrop-blur-xl border border-dark-600 rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-3">
            <div>
              <div className="text-sm font-semibold text-white">小蔡</div>
              <div className="text-xs text-slate-500 mt-0.5">搞出這個網站的人 ヾ(•ω•`)o</div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="w-6 h-6 flex items-center justify-center rounded-full bg-dark-600 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="px-4 pb-4 space-y-3">
            {/* Website */}
            <a
              href="https://小蔡.tw"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-dark-700 border border-dark-600 hover:border-accent-blue/50 transition-colors group"
            >
              <div className="w-7 h-7 rounded-lg bg-accent-blue/20 flex items-center justify-center flex-shrink-0">
                <Globe className="w-3.5 h-3.5 text-accent-blue" />
              </div>
              <div className="min-w-0">
                <div className="text-xs text-slate-500">個人網站</div>
                <div className="text-xs font-medium text-slate-300 group-hover:text-white transition-colors">小蔡.tw</div>
              </div>
            </a>

            {/* Binance */}
            <div className="px-3 py-2.5 rounded-xl bg-dark-700 border border-dark-600">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                  <Coffee className="w-3.5 h-3.5 text-yellow-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-slate-500">請我喝咖啡 ☕</div>
                  <div className="text-xs text-slate-400 mt-0.5">幣安 Binance Pay ID</div>
                </div>
              </div>
              <div className="flex items-center justify-between mt-2.5 px-2 py-1.5 rounded-lg bg-dark-600">
                <span className="text-sm font-mono font-semibold text-yellow-400 tracking-wider">{binanceId}</span>
                <button
                  onClick={copyId}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
                >
                  {copied
                    ? <><Check className="w-3 h-3 text-accent-green" /><span className="text-accent-green">已複製</span></>
                    : <><Copy className="w-3 h-3" /><span>複製</span></>
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
