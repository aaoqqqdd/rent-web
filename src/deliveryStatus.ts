export type DeliveryStatusInfo = {
  key: string
  label: string
  description: string
  special: boolean
}

const STATUS_MAP: Record<string, DeliveryStatusInfo> = {
  unassigned: { key: 'Unassigned', label: 'Unassigned', description: '您的新预订正在提供给快递员，很快就会分配一名快递员。', special: false },
  accepted: { key: 'Accepted', label: 'Accepted', description: '快递员已接受预订。', special: false },
  on_route_to_pickup: { key: 'On Route to Pickup', label: 'On Route to Pickup', description: '快递员正前往取货地点。', special: false },
  picked_up: { key: 'Picked up', label: 'Picked up', description: '快递员已经取走了包裹。', special: false },
  on_route_to_dropoff: { key: 'On Route to Dropoff', label: 'On Route to Dropoff', description: '快递员有包裹，正在前往投递地点。', special: false },
  tried_to_deliver: { key: 'Tried to deliver', label: 'Tried to deliver', description: '包裹已尝试送达。请联系快递员或 Zoom2u 获取重新交付选项。', special: false },
  dropped_off: { key: 'Dropped Off', label: 'Dropped Off', description: '预订已完成！', special: false },
  cancelled: { key: 'Cancelled', label: 'Cancelled', description: '该预订已被取消，不能更新或取消。', special: true },
  returning: { key: 'Returning', label: 'Returning', description: '已要求将预订退回到取货地点，不能更新或取消。', special: true },
  returned: { key: 'Returned', label: 'Returned', description: '预订已退回到取货地点，不能更新或取消。', special: true },
  on_hold_with_courier: { key: 'On Hold - With Courier', label: 'On Hold - With Courier', description: '预订已暂时暂停，不能更新或取消。', special: true },
}

function statusKey(value: unknown): string {
  return String(value || '').trim().replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase().replace(/[\s-]+/g, '_')
}

export function deliveryStatusInfo(value: unknown): DeliveryStatusInfo {
  const raw = String(value || '').trim()
  return STATUS_MAP[statusKey(raw)] || { key: raw || 'Unknown', label: raw || 'Unknown', description: '配送商已更新订单状态。', special: false }
}

export function isDeliveryStatusLocked(value: unknown): boolean {
  return deliveryStatusInfo(value).special
}
