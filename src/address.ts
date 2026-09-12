export interface AddressSuggestion {
  placeId: string
  text: string
  street: string
  suburb: string
  state: string
  postcode: string
  formattedAddress: string
}

const MELBOURNE_ALIASES = ['melbourne', 'docklands', 'southbank', 'south yarra', 'carlton', 'east melbourne']
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

export function normalizeAddressText(value: unknown): string {
  return String(value || '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

/** 送货只接受墨尔本及 systemSettings.deliveryAreas 配置的周边区域。 */
export function isMelbourneAddress(suburb: string, state: string, fullAddress: string, deliveryAreas: string[]): boolean {
  if (state.trim().toUpperCase() !== 'VIC') return false
  const text = normalizeAddressText(`${suburb} ${fullAddress}`)
  const configured = [...MELBOURNE_ALIASES, ...deliveryAreas]
    .map(normalizeAddressText)
    .filter(Boolean)
    .map((value) => value.replace(/^melbourne\s+cbd$/, 'melbourne'))
  return configured.some((area) => text.includes(area))
}

function stateCode(value: unknown): string {
  const raw = String(value || '').trim()
  return STATE_NAMES[raw.toLowerCase()] || raw.toUpperCase()
}

function fromProvider(properties: Record<string, unknown>, type: string, id: unknown, deliveryAreas: string[]): AddressSuggestion | null {
  const street = [properties.housenumber, properties.house_number, properties.street, properties.road]
    .filter(Boolean).join(' ')
  const suburb = String(properties.suburb || properties.locality || properties.neighbourhood || properties.district || properties.city || properties.town || '').trim()
  const city = String(properties.city || properties.town || properties.municipality || '').trim()
  const state = stateCode(properties.state)
  const postcode = String(properties.postcode || '').trim()
  const formattedAddress = [street, suburb, state, postcode].filter(Boolean).join(', ') || String(properties.display_name || '').trim()
  if (!formattedAddress || !isMelbourneAddress(suburb, state, `${formattedAddress} ${city}`, deliveryAreas)) return null
  const placeId = `${type}_${id || formattedAddress}`.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 300)
  return { placeId, text: formattedAddress, street, suburb, state, postcode, formattedAddress }
}

export async function autocompleteMelbourneAddresses(query: string, deliveryAreas: string[]): Promise<AddressSuggestion[]> {
  const input = query.trim().slice(0, 120)
  if (input.length < 3) return []
  const headers = { Accept: 'application/json', 'User-Agent': 'GeekSlope-Web/1.0 Melbourne address search' }
  const providers: Array<() => Promise<AddressSuggestion[]>> = [
    async () => {
      const response = await fetch(`https://photon.komoot.io/api/?${new URLSearchParams({ q: `${input}, Melbourne, Victoria, Australia`, limit: '8', lang: 'en' })}`, { headers })
      if (!response.ok) throw new Error(`Photon ${response.status}`)
      const data = await response.json() as { features?: Array<{ properties?: Record<string, unknown> }> }
      return (data.features || []).map((feature) => fromProvider(feature.properties || {}, 'photon', feature.properties?.osm_id, deliveryAreas)).filter((item): item is AddressSuggestion => Boolean(item)).slice(0, 6)
    },
    async () => {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${new URLSearchParams({ q: `${input}, Melbourne, Victoria, Australia`, format: 'jsonv2', addressdetails: '1', limit: '8', countrycodes: 'au' })}`, { headers })
      if (!response.ok) throw new Error(`Nominatim ${response.status}`)
      const data = await response.json() as Array<{ address?: Record<string, unknown>; osm_type?: string; osm_id?: unknown; display_name?: string }>
      return data.map((item) => fromProvider({ ...(item.address || {}), display_name: item.display_name }, item.osm_type || 'osm', item.osm_id, deliveryAreas)).filter((item): item is AddressSuggestion => Boolean(item)).slice(0, 6)
    },
  ]
  for (const provider of providers) {
    try {
      const suggestions = await provider()
      if (suggestions.length) return suggestions
    } catch {
      // Try the fallback provider before returning a non-blocking empty result.
    }
  }
  return []
}
