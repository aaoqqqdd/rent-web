// 悬浮联系按钮用的通讯软件图标：品牌色 + 通用线性图形，避免直接照搬官方 logo 路径。
export const CONTACT_CHANNEL_ICONS = {
  whatsapp: {
    color: '#25D366',
    svg: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M12 2C6.49 2 2 6.49 2 12c0 1.85.5 3.58 1.38 5.07L2 22l5.09-1.34A9.94 9.94 0 0 0 12 22c5.51 0 10-4.49 10-10S17.51 2 12 2Zm0 18.18c-1.62 0-3.13-.47-4.42-1.29l-.32-.2-3.02.79.8-2.95-.21-.31A8.15 8.15 0 0 1 3.82 12 8.18 8.18 0 0 1 12 3.82 8.18 8.18 0 0 1 20.18 12 8.18 8.18 0 0 1 12 20.18Zm4.48-6.12c-.25-.12-1.46-.72-1.69-.8-.23-.08-.39-.12-.56.12-.17.25-.64.8-.78.96-.14.17-.29.19-.54.06-.25-.12-1.04-.38-1.98-1.22-.73-.65-1.22-1.46-1.37-1.7-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.14.16-.25.24-.42.08-.17.04-.31-.03-.43-.07-.12-.6-1.45-.82-1.98-.22-.52-.44-.45-.6-.46h-.51c-.17 0-.44.06-.68.31-.23.25-.9.88-.9 2.13s.92 2.46 1.05 2.63c.12.17 1.74 2.65 4.22 3.61 2.48.96 2.48.64 2.93.6.44-.04 1.46-.6 1.66-1.18.21-.58.21-1.08.15-1.18-.06-.1-.23-.17-.47-.29Z"/></svg>',
  },
  telegram: {
    color: '#29A9EB',
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M21 4.5 2.8 11.4c-.9.35-.89 1.66.02 2L7 14.9l2.2 5.7c.3.78 1.36.9 1.84.2l2.3-3.3 4.2 3.1c.78.57 1.9.14 2.08-.8l2.6-14c.17-.9-.75-1.6-1.6-1.3Z"/><path d="m7 14.9 9.6-8.4-7 7.6"/></svg>',
  },
  messenger: {
    color: '#0084FF',
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 3C6.98 3 3 6.69 3 11.25c0 2.6 1.3 4.93 3.4 6.49V21l3.02-1.67c.82.23 1.69.36 2.58.36 5.02 0 9-3.69 9-8.25S17.02 3 12 3Z"/><path d="m8.4 11.7 2.5-2.7 2.1 1.8 2.6-2.7"/></svg>',
  },
  line: {
    color: '#06C755',
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M21 10.8C21 6.8 16.97 3.5 12 3.5S3 6.8 3 10.8c0 3.58 3.2 6.58 7.52 7.2.29.06.68.2.78.45.09.23.06.58.03.81l-.13.8c-.04.23-.18.9.79.49.96-.4 5.2-3.07 7.1-5.26C20.4 13.76 21 12.4 21 10.8Z"/><path d="M8.5 9v4m2.3-4v4l2-4v4m2.2-4v4h1.8"/></svg>',
  },
  viber: {
    color: '#7360F2',
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 3.5c-5.02 0-8.5 3.08-8.5 7.6 0 2.52 1.08 4.6 2.9 6.03l-.4 3.37 3.4-1.82c.84.2 1.72.3 2.6.3 5.02 0 8.5-3.08 8.5-7.88S17.02 3.5 12 3.5Z"/><path d="M9 10.3c0 2.9 1.9 4.7 4.7 4.7M12 8.3c1.5 0 2.4.9 2.4 2.4"/></svg>',
  },
} as const

export type ContactChannelKey = keyof typeof CONTACT_CHANNEL_ICONS
