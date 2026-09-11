import { esc } from '../escape'

const MARK_PATHS = /* html */ `
  <path d="M27 15 L44 41 L35.5 41 L27 28 L18.5 41 L10 41 Z" fill="#7C6CFF"/>
  <path d="M9 41 L17 41 L34 7 L26 7 Z" fill="#FFFFFF"/>`

export function renderBrand(name: string, logo = ''): string {
    if (/^https?:\/\//i.test(logo)) return `<img src="${esc(logo)}" alt="${esc(name)}" class="brand-banner">`
    return /* html */ `
<svg viewBox="0 0 236 48" fill="none" aria-label="${esc(name)}" role="img" class="brand-banner">
  ${MARK_PATHS}
  <text x="60" y="34" font-family="Inter, system-ui, -apple-system, sans-serif" font-size="29" font-weight="700" letter-spacing="0.4" fill="#EAF0F6">${esc(name)}</text>
</svg>`
}

export const FAVICON_SVG = /* svg */ `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="#0A0A0F"/><g transform="translate(16 16) scale(0.6667)">${MARK_PATHS}</g></svg>`