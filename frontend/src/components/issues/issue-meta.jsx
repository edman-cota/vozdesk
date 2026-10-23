/* eslint-disable react-refresh/only-export-components */
import { cn } from '@/lib/utils'

/** Estados en el orden en que se agrupan en la lista */
export const STATUSES = [
  { id: 'in_review', label: 'In Review', color: '#22c55e' },
  { id: 'in_progress', label: 'In Progress', color: '#eab308' },
  { id: 'todo', label: 'Todo', color: '#d4d4d4' },
  { id: 'backlog', label: 'Backlog', color: '#8a8a8a' },
  { id: 'done', label: 'Done', color: '#6366f1' },
  { id: 'canceled', label: 'Canceled', color: '#6b6b6b' },
]

export const STATUS_BY_ID = Object.fromEntries(STATUSES.map((s) => [s.id, s]))

/** Qué estados muestra cada pestaña */
export const TAB_STATUSES = {
  active: ['in_review', 'in_progress', 'todo'],
  backlog: ['backlog'],
  all: STATUSES.map((s) => s.id),
}

export const PRIORITIES = [
  { id: 0, label: 'No priority' },
  { id: 1, label: 'Urgent' },
  { id: 2, label: 'High' },
  { id: 3, label: 'Medium' },
  { id: 4, label: 'Low' },
]

/** Iconos de estado al estilo Linear (SVG propio) */
export function StatusIcon({ status, className }) {
  const s = STATUS_BY_ID[status] ?? STATUS_BY_ID.backlog
  const common = { width: 14, height: 14, viewBox: '0 0 14 14', className: cn('shrink-0', className) }

  if (status === 'backlog') {
    return (
      <svg {...common} fill="none">
        <circle cx="7" cy="7" r="6" stroke={s.color} strokeWidth="1.5" strokeDasharray="1.4 1.65" />
      </svg>
    )
  }
  if (status === 'todo') {
    return (
      <svg {...common} fill="none">
        <circle cx="7" cy="7" r="6" stroke={s.color} strokeWidth="1.5" />
      </svg>
    )
  }
  if (status === 'in_progress' || status === 'in_review') {
    const fraction = status === 'in_progress' ? 0.5 : 0.75
    const r = 3
    const c = 2 * Math.PI * r
    return (
      <svg {...common} fill="none">
        <circle cx="7" cy="7" r="6" stroke={s.color} strokeWidth="1.5" />
        <circle
          cx="7" cy="7" r={r} stroke={s.color} strokeWidth={r * 2}
          strokeDasharray={`${c * fraction} ${c}`} transform="rotate(-90 7 7)"
        />
      </svg>
    )
  }
  if (status === 'done') {
    return (
      <svg {...common}>
        <circle cx="7" cy="7" r="7" fill={s.color} />
        <path d="M4.2 7.2 6.1 9l3.7-4" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <circle cx="7" cy="7" r="7" fill={s.color} />
      <path d="m4.8 4.8 4.4 4.4m0-4.4L4.8 9.2" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

/** Iconos de prioridad: barras, "---" o urgente */
export function PriorityIcon({ priority, className }) {
  const common = { width: 14, height: 14, viewBox: '0 0 14 14', className: cn('shrink-0', className) }

  if (priority === 1) {
    return (
      <svg {...common}>
        <rect x="1" y="1" width="12" height="12" rx="3" fill="#f97316" />
        <rect x="6.25" y="3.5" width="1.5" height="4.5" rx=".75" fill="#1a1a1a" />
        <circle cx="7" cy="10" r=".9" fill="#1a1a1a" />
      </svg>
    )
  }
  if (!priority) {
    return (
      <svg {...common} fill="#7a7a7a">
        <rect x="1.5" y="6.25" width="2.5" height="1.5" rx=".5" />
        <rect x="5.75" y="6.25" width="2.5" height="1.5" rx=".5" />
        <rect x="10" y="6.25" width="2.5" height="1.5" rx=".5" />
      </svg>
    )
  }
  const level = { 2: 3, 3: 2, 4: 1 }[priority]
  return (
    <svg {...common}>
      {[0, 1, 2].map((i) => (
        <rect
          key={i} x={1.5 + i * 4} y={9 - i * 3} width="3" height={3 + i * 3} rx="1"
          fill={i < level ? '#bdbdbd' : '#4a4a4a'}
        />
      ))}
    </svg>
  )
}
