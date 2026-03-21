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
const gaId = (import.meta as unknown as { env: Record<string, string> }).env.VITE_GA_ID
if (gaId) {
  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`
  script.onerror = () => {}
  script.onload = () => {
    ;(window as unknown as Record<string, unknown>).dataLayer =
      (window as unknown as Record<string, unknown>).dataLayer ?? []
    function gtag(...args: unknown[]) {
      ;((window as unknown as Record<string, unknown>).dataLayer as unknown[]).push(args)
    }
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
