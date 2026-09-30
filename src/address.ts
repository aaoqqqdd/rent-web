export interface AddressSuggestion {
  placeId: string
  text: string
  street: string
  suburb: string
  state: string
  postcode: string
  formattedAddress: string
}

const PROVIDER_TIMEOUT_MS = 1500

const STATE_NAMES: Record<string, string> = {
  victoria: 'VIC', vic: 'VIC',
  'new south wales': 'NSW', nsw: 'NSW',
  queensland: 'QLD', qld: 'QLD',
  'south australia': 'SA', sa: 'SA',
  'western australia': 'WA', wa: 'WA',
  tasmania: 'TAS', tas: 'TAS',
  'northern territory': 'NT', nt: 'NT',
  'australian capital territory': 'ACT', act: 'ACT',
}

function stateCode(value: unknown): string {
  const raw = String(value || '').trim()
  return STATE_NAMES[raw.toLowerCase()] || raw.toUpperCase()
}

function houseNumber(properties: Record<string, unknown>): string {
  const explicit = String(properties.housenumber || properties.house_number || '').trim()
  if (explicit) return explicit

  // Photon commonly returns the number as `name` for an address feature,
  // e.g. { name: '568', street: 'Collins Street' }.
  return String(properties.name || '').trim().match(/^\d+[a-z]?\b/i)?.[0] || ''
}

function fromProvider(properties: Record<string, unknown>, type: string, id: unknown): AddressSuggestion | null {
  const number = houseNumber(properties)
  const streetName = String(properties.street || properties.road || '').trim()
  const street = [number, streetName].filter(Boolean).join(' ') || String(properties.name || '').trim()
  const rawSuburb = String(properties.suburb || properties.locality || properties.neighbourhood || properties.district || properties.city || properties.town || '').trim()
  const city = String(properties.city || properties.town || properties.municipality || '').trim()
  const state = stateCode(properties.state)
  const postcode = String(properties.postcode || '').trim()
  const suburb = rawSuburb || city
  const formattedParts = [street, rawSuburb, city, state, postcode].filter(Boolean).filter((value, index, values) => values.indexOf(value) === index)
  const formattedAddress = formattedParts.join(', ') || String(properties.display_name || '').trim()
  if (!formattedAddress) return null
  const placeId = `${type}_${id || formattedAddress}`.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 300)
  return { placeId, text: formattedAddress, street, suburb, state, postcode, formattedAddress }
}

export async function autocompleteAddresses(query: string): Promise<AddressSuggestion[]> {
  const input = query.trim().slice(0, 120)
  if (!input) return []
  const headers = { Accept: 'application/json', 'User-Agent': 'GeekSlope-Web/1.0 address search' }
  const providers: Array<(signal: AbortSignal) => Promise<AddressSuggestion[]>> = [
    async (signal) => {
      const response = await fetch(`https://photon.komoot.io/api/?${new URLSearchParams({ q: input, lang: 'en' })}`, { headers, signal })
      if (!response.ok) throw new Error(`Photon ${response.status}`)
      const data = await response.json() as { features?: Array<{ properties?: Record<string, unknown> }> }
      return (data.features || []).map((feature) => fromProvider(feature.properties || {}, 'photon', feature.properties?.osm_id)).filter((item): item is AddressSuggestion => Boolean(item))
    },
    async (signal) => {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${new URLSearchParams({ q: input, format: 'jsonv2', addressdetails: '1' })}`, { headers, signal })
      if (!response.ok) throw new Error(`Nominatim ${response.status}`)
      const data = await response.json() as Array<{ address?: Record<string, unknown>; osm_type?: string; osm_id?: unknown; display_name?: string }>
      return data.map((item) => fromProvider({ ...(item.address || {}), display_name: item.display_name }, item.osm_type || 'osm', item.osm_id)).filter((item): item is AddressSuggestion => Boolean(item))
    },
  ]
  const controllers: AbortController[] = []
  try {
    // Ask both providers at once and use the first provider that returns usable results.
    // This avoids waiting for a slow primary provider before trying the fallback.
    return await Promise.any(providers.map((provider) => {
      const controller = new AbortController()
      controllers.push(controller)
      const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS)
      return provider(controller.signal).then((suggestions) => {
        if (!suggestions.length) throw new Error('No address suggestions')
        return suggestions
      }).finally(() => clearTimeout(timeout))
    }))
  } catch {
    // Both providers failed, timed out, or returned no usable addresses.
    return []
  } finally {
    controllers.forEach((controller) => controller.abort())
  }
}
