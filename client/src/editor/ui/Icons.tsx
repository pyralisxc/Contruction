import React from 'react'

type IconName =
  | 'activity'
  | 'box'
  | 'cart'
  | 'check'
  | 'chevronDown'
  | 'code'
  | 'copy'
  | 'cube'
  | 'door'
  | 'download'
  | 'draw'
  | 'export'
  | 'flag'
  | 'grid'
  | 'help'
  | 'home'
  | 'layers'
  | 'load'
  | 'measure'
  | 'move'
  | 'panel'
  | 'pointer'
  | 'redo'
  | 'roof'
  | 'save'
  | 'settings'
  | 'spark'
  | 'store'
  | 'undo'
  | 'wall'
  | 'warning'

const paths: Record<IconName, React.ReactNode> = {
  activity: <path d="M4 12h4l2-6 4 12 2-6h4" />,
  box: <path d="m4 7 8-4 8 4v10l-8 4-8-4V7Zm8 4 8-4M12 11 4 7m8 4v10" />,
  cart: <path d="M5 5h2l1.2 9h8.6l1.2-6H8.5M10 19h.01M17 19h.01" />,
  check: <path d="m5 12 4 4L19 6" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  code: <path d="m8 9-4 3 4 3m8-6 4 3-4 3m-2-9-4 12" />,
  copy: <path d="M8 8h10v10H8zM6 16H4V4h12v2" />,
  cube: <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Zm0 9 8-4.5M12 12 4 7.5m8 4.5V21" />,
  door: <path d="M7 21V4h10v17M10 12h.01" />,
  download: <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 19h16" />,
  draw: <path d="m4 20 4-1 10-10-3-3L5 16l-1 4Zm11-14 3-3 3 3-3 3" />,
  export: <path d="M14 4h6v6m0-6-8 8M20 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4" />,
  flag: <path d="M6 21V4h11l-2 4 2 4H6" />,
  grid: <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />,
  help: <path d="M9.5 9a2.5 2.5 0 1 1 4 2c-.9.6-1.5 1.1-1.5 2.5M12 18h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />,
  home: <path d="m3 11 9-8 9 8M5 10v10h14V10M9 20v-6h6v6" />,
  layers: <path d="m12 3 9 5-9 5-9-5 9-5Zm-7 9 7 4 7-4M5 16l7 4 7-4" />,
  load: <path d="M12 21V9m0 0 4 4m-4-4-4 4M4 5h16" />,
  measure: <path d="M4 17 17 4l3 3L7 20l-3-3Zm3-3 3 3m0-6 3 3m0-6 3 3" />,
  move: <path d="M12 3v18m0-18-3 3m3-3 3 3m0 15-3 3m3-3-3-3M3 12h18M3 12l3-3m-3 3 3 3m15-3-3-3m3 3-3 3" />,
  panel: <path d="M4 5h16v14H4zM9 5v14" />,
  pointer: <path d="M5 3 19 14l-7 1-4 6L5 3Z" />,
  redo: <path d="M20 7v6h-6M20 13a8 8 0 1 0-2.3 5.7" />,
  roof: <path d="M3 12 12 4l9 8M6 10v10h12V10" />,
  save: <path d="M5 4h12l2 2v14H5zM8 4v6h8M8 20v-6h8v6" />,
  settings: <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm8.5 4-2.1-.8-.8-1.9.9-2-1.8-1.8-2 .9-1.9-.8L12 3.5h-2.5l-.8 2.1-1.9.8-2-.9L3 7.3l.9 2-.8 1.9L1 12l.8 2.5 2.1.8.8 1.9-.9 2 1.8 1.8 2-.9 1.9.8.8 2.1H12l.8-2.1 1.9-.8 2 .9 1.8-1.8-.9-2 .8-1.9 2.1-.8V12Z" />,
  spark: <path d="m12 3 1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3Zm6 12 .8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8L18 15Z" />,
  store: <path d="M4 10h16l-1-5H5l-1 5Zm2 0v10h12V10M9 20v-6h6v6" />,
  undo: <path d="M4 7v6h6M4 13a8 8 0 1 1 2.3 5.7" />,
  wall: <path d="M4 7h16v10H4zM4 12h16M9 7v5m6 0v5" />,
  warning: <path d="M12 4 3 20h18L12 4Zm0 6v4m0 3h.01" />,
}

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg className="ui-icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
        {paths[name]}
      </g>
    </svg>
  )
}
