import { esc } from '../escape'

const MARK_SVG = /* html */ `
  <circle cx="32" cy="32" r="32" fill="#0A0A0F"/>
  <g transform="translate(10 10)">
    <path d="M24 10 42 39 33 39 24 25 15 39 6 39Z" fill="#2563EB"/>
    <path d="M5 39 14 39 33 4 24 4Z" fill="#FFFFFF"/>
  </g>`

export function renderBrand(name: string, _logo = ''): string {
    return /* html */ `
<svg viewBox="0 0 236 48" fill="none" aria-label="${esc(name)}" role="img" class="brand-banner">
  <svg x="0" y="0" width="48" height="48" viewBox="0 0 64 64" aria-hidden="true">${MARK_SVG}</svg>
  <text x="60" y="34" font-family="Inter, system-ui, -apple-system, sans-serif" font-size="29" font-weight="700" letter-spacing="0.4" fill="#EAF0F6">${esc(name)}</text>
</svg>`
}

export const FAVICON_SVG = /* svg */ `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${MARK_SVG}</svg>`
