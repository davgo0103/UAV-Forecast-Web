import { useState, useRef, useEffect } from 'react'
import { Search, X, Loader2 } from 'lucide-react'
import { searchLocation, reverseGeocode, SearchResult } from '../services/geocoding'
import { useStore } from '../store/useStore'

// Match "lat, lon" or "lat lon" with optional signs and decimals
const COORD_RE = /^\s*(-?\d{1,3}(?:\.\d+)?)[,\s]+(-?\d{1,3}(?:\.\d+)?)\s*$/

function parseCoords(q: string): { lat: number; lon: number } | null {
  const m = q.match(COORD_RE)
  if (!m) return null
  const lat = parseFloat(m[1])
  const lon = parseFloat(m[2])
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null
  return { lat, lon }
}

export default function SearchBar() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reqIdRef = useRef(0)
  const setLocation = useStore((s) => s.setLocation)

  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      setShowDropdown(false)
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const id = ++reqIdRef.current
      setIsLoading(true)
      try {
        const coords = parseCoords(query)
        let data: SearchResult[]
        if (coords) {
          const loc = await reverseGeocode(coords.lat, coords.lon)
          data = [{
            name: loc.name,
            displayName: `${coords.lat.toFixed(6)}, ${coords.lon.toFixed(6)}`,
            lat: coords.lat,
            lon: coords.lon,
          }]
        } else {
          data = await searchLocation(query)
        }
        // Discard stale results if a newer request was fired
        if (id !== reqIdRef.current) return
        setResults(data)
        setShowDropdown(true)
      } catch (err) {
        if (id !== reqIdRef.current) return
        if (import.meta.env.DEV) console.warn('[SearchBar] search failed:', err)
      } finally {
        if (id === reqIdRef.current) setIsLoading(false)
      }
    }, 400)
  }, [query])

  function handleSelect(result: SearchResult) {
    setLocation({ lat: result.lat, lon: result.lon, name: result.name })
    setQuery(result.name)
    setShowDropdown(false)
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2 bg-dark-600 border border-dark-500 rounded-lg px-3 py-2">
        {isLoading ? (
          <Loader2 className="w-4 h-4 text-slate-400 animate-spin flex-shrink-0" />
        ) : (
          <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
        )}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜尋地點或輸入經緯度（25.04, 121.53）"
          className="flex-1 bg-transparent text-white placeholder-slate-500 outline-none min-w-0"
          style={{ fontSize: '16px' }}
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setShowDropdown(false) }}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {showDropdown && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-dark-700 border border-dark-500 rounded-lg shadow-xl z-50 overflow-hidden">
          {results.map((r, i) => (
            <button
              key={i}
              onClick={() => handleSelect(r)}
              className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:bg-dark-600 hover:text-white transition-colors border-b border-dark-600 last:border-0"
            >
              <div className="font-medium text-white">{r.name}</div>
              <div className="text-xs text-slate-500 truncate mt-0.5">{r.displayName}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
