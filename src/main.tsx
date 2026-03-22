import React from 'react'
import ReactDOM from 'react-dom/client'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import App from './App'
import './index.css'

dayjs.extend(utc)
dayjs.extend(timezone)

// Load Google Analytics — silently skip if blocked by DNS/network
const gaId = import.meta.env.VITE_GA_ID
if (gaId) {
  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`
  script.onerror = () => {}
  script.onload = () => {
    const w = window as unknown as Record<string, unknown>
    w.dataLayer = w.dataLayer ?? []
    w.gtag = function (...args: unknown[]) {
      ;(w.dataLayer as unknown[]).push(args)
    }
    const gtag = w.gtag as (...args: unknown[]) => void
    gtag('js', new Date())
    gtag('config', gaId)
  }
  document.head.appendChild(script)
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
