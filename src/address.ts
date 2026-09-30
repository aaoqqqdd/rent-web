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
const MELBOURNE_VIEWBOX = '144.4,-38.2,145.5,-37.4'

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

/** 送货资格仅按维州和已配置的配送邮编判断，不按郊区名称过滤。 */
export function isMelbourneDeliveryPostcode(state: string, postcode: string, deliveryPostcodes: string[]): boolean {
  return state.trim().toUpperCase() === 'VIC' && deliveryPostcodes.includes(postcode.trim())
}

function stateCode(value: unknown): string {
  const raw = String(value || '').trim()
  return STATE_NAMES[raw.toLowerCase()] || raw.toUpperCase()
}

function fromProvider(properties: Record<string, unknown>, type: string, id: unknown): AddressSuggestion | null {
  const street = [properties.housenumber, properties.house_number, properties.street, properties.road]
    .filter(Boolean).join(' ')
  const rawSuburb = String(properties.suburb || properties.locality || properties.neighbourhood || properties.district || properties.city || properties.town || '').trim()
  const city = String(properties.city || properties.town || properties.municipality || '').trim()
  const state = stateCode(properties.state)
  const postcode = String(properties.postcode || '').trim()
  const suburb = rawSuburb || city
  const formattedParts = [street, rawSuburb, city, state, postcode].filter(Boolean).filter((value, index, values) => values.indexOf(value) === index)
  const formattedAddress = formattedParts.join(', ') || String(properties.display_name || '').trim()
  if (!formattedAddress || state !== 'VIC') return null
  const placeId = `${type}_${id || formattedAddress}`.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 300)
  return { placeId, text: formattedAddress, street, suburb, state, postcode, formattedAddress }
}

function matchesAddressQuery(suggestion: AddressSuggestion, query: string): boolean {
  const input = query.trim()
  const houseNumber = input.match(/^(\d+[a-z]?)(?:\s|,|$)/i)?.[1]?.toLowerCase()
  const suggestionNumber = normalizeAddressText(suggestion.street).split(' ')[0]
  if (houseNumber && suggestionNumber !== houseNumber) return false

  const postcode = input.match(/\b\d{4}\b/)?.[0]
  if (postcode && suggestion.postcode !== postcode) return false

  const suggestionText = normalizeAddressText(`${suggestion.street} ${suggestion.suburb} ${suggestion.state} ${suggestion.postcode}`)
  const localityParts = input.split(',').slice(1)
    .map(normalizeAddressText)
    .filter((part) => part && !/^\d{4}$/.test(part) && !['australia', 'victoria', 'vic'].includes(part))
  return localityParts.every((part) => suggestionText.includes(part))
}

export async function autocompleteMelbourneAddresses(query: string): Promise<AddressSuggestion[]> {
  const input = query.trim().slice(0, 120)
  if (input.length < 3) return []
  const headers = { Accept: 'application/json', 'User-Agent': 'GeekSlope-Web/1.0 Melbourne address search' }
  const providers: Array<(signal: AbortSignal) => Promise<AddressSuggestion[]>> = [
    async (signal) => {
      const response = await fetch(`https://photon.komoot.io/api/?${new URLSearchParams({ q: input, limit: '4', lang: 'en', bbox: MELBOURNE_VIEWBOX })}`, { headers, signal })
      if (!response.ok) throw new Error(`Photon ${response.status}`)
      const data = await response.json() as { features?: Array<{ properties?: Record<string, unknown> }> }
      return (data.features || []).map((feature) => fromProvider(feature.properties || {}, 'photon', feature.properties?.osm_id)).filter((item): item is AddressSuggestion => Boolean(item)).filter((item) => matchesAddressQuery(item, input)).slice(0, 6)
    },
    async (signal) => {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${new URLSearchParams({ q: input, format: 'jsonv2', addressdetails: '1', limit: '4', countrycodes: 'au', viewbox: MELBOURNE_VIEWBOX, bounded: '1' })}`, { headers, signal })
      if (!response.ok) throw new Error(`Nominatim ${response.status}`)
      const data = await response.json() as Array<{ address?: Record<string, unknown>; osm_type?: string; osm_id?: unknown; display_name?: string }>
      return data.map((item) => fromProvider({ ...(item.address || {}), display_name: item.display_name }, item.osm_type || 'osm', item.osm_id)).filter((item): item is AddressSuggestion => Boolean(item)).filter((item) => matchesAddressQuery(item, input)).slice(0, 6)
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
    // Both providers failed, timed out, or returned no usable Melbourne addresses.
    return []
  } finally {
    controllers.forEach((controller) => controller.abort())
  }
}
