import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export function PopoverDropdown({
  trigger,
  children,
  open,
  onOpenChange,
  align = 'start',
  sideOffset = 4,
  className,
}) {
  const contentAlign = align === 'right' ? 'end' : align === 'left' ? 'start' : align

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
        {trigger}
      </PopoverTrigger>
      <PopoverContent
        align={contentAlign}
        sideOffset={sideOffset}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'w-auto min-w-[180px] p-1 shadow-2xl shadow-black/70 backdrop-blur-md',
          className
        )}
      >
        {children}
      </PopoverContent>
    </Popover>
  )
}

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor } from '@/components/ui/popover'
export default PopoverDropdown
