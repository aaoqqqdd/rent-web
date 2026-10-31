import { SITE_URL } from './seo'

export const DISCOVERY_LINK_HEADER = [
  `<${SITE_URL}/.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json"`,
  `<${SITE_URL}/openapi.json>; rel="service-desc"; type="application/json"`,
  `<${SITE_URL}/api-docs.md>; rel="service-doc"; type="text/markdown"`,
  `<${SITE_URL}/auth.md>; rel="describedby"; type="text/markdown"`,
  `<${SITE_URL}/llms.txt>; rel="describedby"; type="text/plain"`,
].join(', ')

// Only actual public, read-only resources belong in this catalogue. In
// particular, browser checkout is not an agent payment or provisioning API.
export const API_CATALOG = {
  linkset: ['/products', '/api/device-availability', '/api/public-notices'].map((path) => ({
    anchor: `${SITE_URL}${path}`,
    'service-desc': [{ href: `${SITE_URL}/openapi.json`, type: 'application/json' }],
    'service-doc': [{ href: `${SITE_URL}/api-docs.md`, type: 'text/markdown' }],
    status: [{ href: `${SITE_URL}/healthz`, type: 'text/plain' }],
  })),
}

const pageContent = {
  'text/html': { schema: { type: 'string' } },
  'text/markdown': { schema: { type: 'string' } },
}

export const OPENAPI_DOCUMENT = {
  openapi: '3.1.0',
  info: {
    title: 'GeekSlope Public Information API',
    version: '1.0.0',
    description: 'Read-only equipment pages, public notices and rental availability. These resources do not create accounts, reserve equipment or take payment. Availability is indicative and is rechecked during the existing rental process.',
  },
  servers: [{ url: SITE_URL }],
  externalDocs: { description: 'Usage and authentication', url: `${SITE_URL}/api-docs.md` },
  security: [],
  paths: {
    '/products': {
      get: {
        operationId: 'listEquipmentPages',
        summary: 'Browse equipment, specifications, rental rates and product links',
        description: 'Returns an HTML page by default or Markdown when Accept: text/markdown is explicitly preferred. This is not a JSON inventory API. Browser search and category filtering run in JavaScript; Markdown contains the complete server-rendered catalogue. Rates are in AUD and are not a confirmed quote.',
        responses: { '200': { description: 'Current catalogue, or an explanatory empty state if data is unavailable', content: pageContent } },
      },
    },
    '/products/{id}': {
      get: {
        operationId: 'getEquipmentPage',
        summary: 'Read one equipment page',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Use the product identifier from a catalogue link.' }],
        responses: {
          '200': { description: 'Specifications, indicative rental rates, deposit and service information', content: pageContent },
          '404': { description: 'Product missing or removed; the original noindex policy is preserved', content: pageContent },
        },
      },
    },
    '/api/device-availability': {
      get: {
        operationId: 'getDeviceAvailability',
        summary: 'Read unavailable rental dates and periods for up to ten devices',
        description: 'No customer or order identifiers are returned. An empty result is not a reservation or a guarantee of availability. Existing request limits, crawl rules and final rental validation still apply.',
        parameters: [{
          name: 'deviceIds', in: 'query', required: false,
          description: 'JSON-encoded array of device IDs. Comma-separated IDs are also accepted. Only the first ten input IDs are considered; duplicates and empty IDs are removed. Missing input returns an empty availability map.',
          schema: { type: 'string' }, example: '["device-1","device-2"]',
        }],
        responses: {
          '200': {
            description: 'Availability records keyed by device ID; unavailable data can fall back to empty records',
            content: { 'application/json': { schema: {
              type: 'object', required: ['availability'], properties: {
                availability: { type: 'object', additionalProperties: { $ref: '#/components/schemas/DeviceAvailability' } },
              },
            } } },
          },
        },
      },
    },
    '/api/public-notices': {
      get: {
        operationId: 'listPublicNotices',
        summary: 'Read current public announcements and valid coupon information',
        parameters: [{ name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 }, description: 'Requested result limit; finite values are clamped to 1–100, invalid values use 20.' }],
        responses: {
          '200': {
            description: 'Public notices, excluding private recipients and internal coupon usage records; may be empty if data is unavailable',
            content: { 'application/json': { schema: {
              type: 'object', required: ['notices'], properties: {
                notices: { type: 'array', items: { $ref: '#/components/schemas/PublicNotice' } },
              },
            } } },
          },
        },
      },
    },
    '/healthz': {
      get: {
        operationId: 'getLiveness', summary: 'Check Worker liveness',
        description: 'Does not check D1, payment providers, stock or delivery availability.',
        responses: { '200': { description: 'Worker is responding', content: { 'text/plain': { schema: { type: 'string', const: 'ok' } } } } },
      },
    },
  },
  components: {
    schemas: {
      DeviceAvailability: {
        type: 'object', required: ['unavailableDates', 'rentalRanges', 'unavailablePeriods', 'unavailableTimeSlots'],
        properties: {
          unavailable: { type: 'boolean', description: 'True when the device cannot be booked or a return date is unknown.' },
          unavailableDates: { type: 'array', items: { type: 'string', format: 'date' } },
          rentalRanges: { type: 'array', items: { type: 'object', required: ['startDate', 'endDate'], properties: { startDate: { type: 'string', format: 'date' }, endDate: { type: 'string', format: 'date' } } } },
          unavailablePeriods: { type: 'object', additionalProperties: { type: 'array', items: { type: 'string', enum: ['AM', 'PM'] } } },
          unavailableTimeSlots: { type: 'object', additionalProperties: { type: 'array', items: { type: 'string' } } },
        },
      },
      PublicNotice: {
        type: 'object', required: ['id', 'kind', 'title', 'message', 'createdAt'],
        properties: {
          id: { type: 'string' }, kind: { type: 'string', enum: ['announcement', 'coupon'] },
          title: { type: 'string' }, message: { type: 'string' }, createdAt: { type: 'string' },
          titleEn: { type: 'string' }, messageEn: { type: 'string' }, expiresAt: { type: 'string' },
          couponCode: { type: 'string' }, couponDiscount: { type: 'string' },
        },
        additionalProperties: true,
      },
    },
  },
}

export const API_DOCS = `# GeekSlope Public Information API

## Audience and scope

For agents and clients helping users research computer rental in Melbourne.
The published interface is read-only and requires no account or API key.
All prices are AUD. Reading a page or checking dates does not reserve a device.

## Discovery

- [API catalog](${SITE_URL}/.well-known/api-catalog): RFC 9727 linkset.
- [OpenAPI 3.1](${SITE_URL}/openapi.json): paths, input formats and response schemas.
- [Authentication and registration](${SITE_URL}/auth.md).
- [Content index](${SITE_URL}/llms.txt).

## Equipment and prices

GET ${SITE_URL}/products

Use Accept: text/markdown for readable specifications, indicative rates, deposits and product links.
Follow those links to GET /products/{id}; missing or removed equipment returns 404.
Without an explicit Markdown preference, these resources return HTML, not JSON.
Client-side search and category controls do not filter the Markdown catalogue.
Consult [the rental guide](${SITE_URL}/rental-guide) for current rules and delivery scope.

## Device availability

GET ${SITE_URL}/api/device-availability?deviceIds=%5B%22device-1%22%5D

The deviceIds query is a JSON array encoded in a URL; comma-separated IDs are also accepted.
Use IDs from equipment links, at most ten per request. The JSON response contains an availability
map keyed by ID, with unavailableDates, rentalRanges, unavailablePeriods and unavailableTimeSlots.
An optional unavailable flag means booking is not available. Dates and periods use local rental
rules. Results contain no customer information and do not create a hold or confirmed booking.

## Public notices

GET ${SITE_URL}/api/public-notices?limit=20

Returns a JSON notices array containing current announcements and valid coupons.
The requested limit defaults to 20 and is clamped to 1–100. Data can be empty when no notice is
active or the shared database is unavailable. Public JSON responses use no-store; avoid repeated
polling, observe crawl rules and back off on errors. No cross-origin browser CORS access is promised.

## Status and data quality

GET ${SITE_URL}/healthz returns the plain text ok. It checks Worker liveness only.
Display queries fail softly: HTTP 200 and empty records do not prove database readiness, a
confirmed price or a free rental slot. The existing rental flow rechecks availability and fees.

## Accounts, applications and payment

Use [the website](${SITE_URL}/login?tab=login) for human registration and sign-in, and the existing
browser checkout for rental applications. Existing approval, contract, card verification or
authorization, and payment rules still apply. This catalog does not grant permission to create
accounts, sign contracts or pay on another person's behalf.

There is no advertised machine account registration, OAuth authorization server, delegated
bearer-token flow, A2A payment agent, ACP, AP2, MPP, UCP or x402 implementation. No payable
operation or payment-discovery extension is declared. Existing checkout errors that use HTTP 402
are payment failures in the browser flow, not x402 or MPP challenges.
`

export const AUTH_MD = `# GeekSlope auth.md

## Agent audience

Agents may research public equipment, rental rules, announcements and availability for users.
The [documented public API](${SITE_URL}/openapi.json) is read-only: no registration, API key,
OAuth token or other credential is required to read it.

## Registration and provisioning

Supported method: human-assisted customer registration using email and password in the website.
The person opens [registration](${SITE_URL}/register) or the registration tab on the login page.
The existing POST /register handler backs that browser form and applies validation, rate limits
and Turnstile when configured. It creates a real customer account; it is not an agent enrollment
or passive discovery endpoint. Do not POST it merely to test whether registration exists.

There is no machine-to-machine provisioning endpoint, agent-specific credential, anonymous
agent claim, verified-email assertion exchange, ID-JAG registration or agent_auth metadata.

## Sign-in and credential use

Supported method: human sign-in with the existing account credentials at
[the login page](${SITE_URL}/login?tab=login), backed by POST /login. Successful sign-in creates
the existing HttpOnly session cookie. The browser uses that cookie for the user's account;
the existing SSO handoff connects the website to the customer dashboard. GET /api/session only
reports whether that current browser session is authenticated. Session cookies are not OAuth
bearer tokens and must not be placed in URLs, public documents or shared caches.

There is no published OAuth issuer, authorization server, protected-resource metadata, scopes,
bearer-token grant, token endpoint or client registration flow. Therefore this service does not
publish OAuth discovery documents claiming those features. Public discovery does not authorize
access to a user's orders or balance and does not grant delegated signing or payment authority.

## Human-controlled rental actions

Account creation, submitting an application, signing a contract and payment must follow the
existing website flow with the person's authorization. Automated discovery must use GET or
HEAD on public documents. Do not probe registration, payment, order or delivery write handlers.
Use [contact information](${SITE_URL}/about#contact) for questions about future agent integrations.
`
