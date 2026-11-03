/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import type { Env } from './index'
import { esc } from './escape'

const PHOTO_SLOTS = [['a','A 面（顶盖）'],['b','B 面（屏幕）'],['c','C 面（键盘）'],['d','D 面（底盖）'],['power','屏幕开机画面'],['extra','配件与接口']] as const
export interface OwnerRental {
  mode: 'self' | 'managed'
  city: string
  photos: Array<{slot:string;label:string;url:string}>
  eligible: boolean
}
function photoUrl(value: unknown): string {
  try {
    const url = new URL(String(value || ''))
    return url.protocol === 'https:' && url.hostname === 'res.cloudinary.com' && !url.username && !url.password && !url.port ? url.href : ''
  } catch { return '' }
}
export async function ownerRentals(env: Env): Promise<Map<string,OwnerRental>> {
  const required = PHOTO_SLOTS.filter(([slot])=>slot!=='extra').map(([slot])=>`EXISTS (SELECT 1 FROM c2c_photos p WHERE p.id=json_extract(l.photos_json,'$.${slot}.id') AND p.owner_id=l.owner_id AND p.slot='${slot}' AND p.url=json_extract(l.photos_json,'$.${slot}.url'))`).join(' AND ')
  try {
    const result = await env.RENT.prepare(`SELECT l.device_id,l.listing_mode,l.public_city,l.pickup_address_json,l.photos_json,
      (l.status='approved' AND u.status='active' AND u.deleted_at IS NULL AND m.user_id IS NOT NULL
      AND l.listing_mode=m.mode AND length(trim(l.pickup_address))>0
      AND (l.listing_mode='self' OR (l.custody_received_at IS NOT NULL AND s.managed_commission_bps IS NOT NULL))
      AND ${required}) AS eligible
      FROM c2c_listings l LEFT JOIN users u ON u.id=l.owner_id LEFT JOIN c2c_memberships m ON m.user_id=l.owner_id CROSS JOIN c2c_settings s`).all<Record<string,unknown>>()
    return new Map((result.results || []).map(row=>{
      let data: Record<string,any> = {}
      try { data=JSON.parse(String(row.photos_json || '{}')) || {} } catch { /* invalid photos cannot be published */ }
      const photos=PHOTO_SLOTS.flatMap(([slot,label])=>{
        const url=photoUrl(data[slot]?.url)
        return url ? [{slot,label,url}] : []
      })
      return [String(row.device_id),{mode:row.listing_mode==='managed'?'managed':'self',city:row.listing_mode==='managed'?'墨尔本':String(row.public_city || (()=>{try{return JSON.parse(String(row.pickup_address_json||'{}')).city || ''}catch{return ''}})() || '城市待完善'),photos,eligible:Number(row.eligible)===1 && photos.filter(photo=>photo.slot!=='extra').length===5}]
    }))
  } catch (error) {
    // Sites predating the rental-program migration still show platform inventory.
    if (/no such table: c2c_listings/i.test(String(error))) return new Map()
    throw error
  }
}
export function ownerRentalLabel(rental?: OwnerRental): string {
  return rental ? rental.mode === 'managed' ? '个人设备 · 平台托管' : '个人设备 · 自行交付' : '平台自营'
}
export function ownerRentalImage(rental: OwnerRental | undefined,name: string): string {
  return rental?.photos[0] ? `<img class="owner-rental-image" src="${esc(rental.photos[0].url)}" alt="${esc(name)}" loading="lazy">` : ''
}
export function ownerRentalGallery(rental: OwnerRental): string {
  return `<div class="owner-rental-gallery">${rental.photos.map(photo=>`<figure><a href="${esc(photo.url)}" target="_blank" rel="noopener noreferrer"><img src="${esc(photo.url)}" alt="${esc(photo.label)}" loading="lazy"></a><figcaption>${esc(photo.label)}</figcaption></figure>`).join('')}</div>`
}
export function ownerRentalBookingUrl(appUrl: string,deviceId: string): string {
  return `${appUrl.replace(/\/$/,'')}/customer/rent/${encodeURIComponent(deviceId)}`
}

export async function ownerRentalRevision(env: Env): Promise<string> {
  const rows=[...await ownerRentals(env)].sort(([a],[b])=>a.localeCompare(b))
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(rows)))
  return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('')
}
