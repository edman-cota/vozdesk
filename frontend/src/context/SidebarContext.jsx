import { createContext, useContext, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { cn } from '@/lib/utils'

const SidebarContext = createContext({
  isOpen: false,
  setIsOpen: () => {},
  toggle: () => {},
  close: () => {},
  open: () => {},
})

export function SidebarProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false)
  const location = useLocation()

  // Auto-close mobile sidebar whenever route changes
  useEffect(() => {
    setIsOpen(false)
  }, [location.pathname])

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const toggle = () => setIsOpen((prev) => !prev)
  const close = () => setIsOpen(false)
  const open = () => setIsOpen(true)

  return (
    <SidebarContext.Provider value={{ isOpen, setIsOpen, toggle, close, open }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  const ctx = useContext(SidebarContext)
  if (!ctx) {
    throw new Error('useSidebar must be used within a SidebarProvider')
  }
  return ctx
}

export function SidebarTrigger({ className }) {
  const { toggle, isOpen } = useSidebar()

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isOpen ? 'Cerrar menú' : 'Abrir menú'}
      aria-expanded={isOpen}
      className={cn(
        'grid size-8 place-items-center rounded-md text-muted-foreground transition-colors',
        'hover:bg-white/[0.06] hover:text-foreground md:hidden shrink-0',
        className
      )}
    >
      <Menu className="size-4" />
    </button>
  )
}
