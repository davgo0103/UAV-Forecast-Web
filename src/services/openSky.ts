import axios from 'axios'

export interface Aircraft {
  icao24: string
  callsign: string
  country: string
  longitude: number
  latitude: number
  baroAltitude: number | null // meters
  onGround: boolean
  velocity: number | null     // m/s
  heading: number | null      // degrees true
  verticalRate: number | null // m/s
}

// ── OAuth2 token cache ─────────────────────────────────────────────────────────
const TOKEN_URL = '/opensky-auth/auth/realms/opensky-network/protocol/openid-connect/token'

let cachedToken: string | null = null
let tokenExpiresAt = 0

async function getAccessToken(): Promise<string | null> {
  const clientId = import.meta.env.VITE_OPENSKY_CLIENT_ID
  const clientSecret = import.meta.env.VITE_OPENSKY_CLIENT_SECRET
  if (!clientId || !clientSecret) return null

  // Return cached token if still valid (with 30s buffer)
  if (cachedToken && Date.now() < tokenExpiresAt - 30_000) return cachedToken

  try {
    const res = await axios.post(
      TOKEN_URL,
      new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 8000 }
    )
    cachedToken = res.data.access_token
    tokenExpiresAt = Date.now() + res.data.expires_in * 1000
    return cachedToken
  } catch {
    return null
  }
}

// ── In-memory cache ────────────────────────────────────────────────────────────
const AIRCRAFT_CACHE_TTL = 30 * 1000

interface AircraftCache {
  timestamp: number
  bounds: { north: number; south: number; west: number; east: number }
  data: Aircraft[]
}

let aircraftCache: AircraftCache | null = null

function isCacheValid(
  cache: AircraftCache,
  bounds: { north: number; south: number; west: number; east: number }
): boolean {
  if (Date.now() - cache.timestamp > AIRCRAFT_CACHE_TTL) return false
  // Valid if the requested bounds are fully covered by cached bounds
  return (
    bounds.north <= cache.bounds.north &&
    bounds.south >= cache.bounds.south &&
    bounds.west >= cache.bounds.west &&
    bounds.east <= cache.bounds.east
  )
}

// ── Shared fetch logic ─────────────────────────────────────────────────────────
function parseStates(states: unknown[][]): Aircraft[] {
  return states
    .map((s) => ({
      icao24: s[0] as string,
      callsign: ((s[1] as string) ?? '').trim(),
      country: s[2] as string,
      longitude: s[5] as number,
      latitude: s[6] as number,
      baroAltitude: s[7] as number | null,
      onGround: s[8] as boolean,
      velocity: s[9] as number | null,
      heading: s[10] as number | null,
      verticalRate: s[11] as number | null,
    }))
    .filter((a) => a.longitude != null && a.latitude != null && !a.onGround)
}

async function doFetch(
  bounds: { north: number; south: number; west: number; east: number },
  token?: string
): Promise<{ data: Aircraft[]; creditsRemaining: number | null }> {
  const headers = token ? { Authorization: `Bearer ${token}` } : {}
  const res = await axios.get('https://opensky-network.org/api/states/all', {
    timeout: 10000,
    headers,
    params: { lamin: bounds.south, lomin: bounds.west, lamax: bounds.north, lomax: bounds.east },
  })
  const raw = res.headers['x-rate-limit-remaining']
  const creditsRemaining = raw != null ? parseInt(raw, 10) : null
  if (!res.data?.states) return { data: [], creditsRemaining }
  return { data: parseStates(res.data.states as unknown[][]), creditsRemaining }
}

export async function fetchAircraft(bounds: {
  north: number
  south: number
  west: number
  east: number
}): Promise<{ aircraft: Aircraft[]; creditsRemaining: number | null }> {
  // Return cache if fresh and bounds are covered
  if (aircraftCache && isCacheValid(aircraftCache, bounds)) {
    return { aircraft: aircraftCache.data, creditsRemaining: null }
  }

  let result: { data: Aircraft[]; creditsRemaining: number | null }
  try {
    result = await doFetch(bounds)
  } catch (err) {
    const status = (err as { response?: { status?: number } })?.response?.status
    if (status !== 429) throw err
    const token = await getAccessToken()
    if (!token) throw err
    result = await doFetch(bounds, token)
  }

  aircraftCache = { timestamp: Date.now(), bounds, data: result.data }
  return { aircraft: result.data, creditsRemaining: result.creditsRemaining }
}
