import { Mic } from 'lucide-react'

/** Vista vacía para secciones aún no implementadas (Inbox, Agent, Projects…) */
export default function PlaceholderPage({ title, description, icon: Icon = Mic }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-11 shrink-0 items-center border-b border-white/[0.06] px-4 text-[13px] font-medium">
        {title}
      </header>
      <div className="grid flex-1 place-items-center p-6">
        <div className="max-w-sm text-center animate-fade-in">
          <div className="mx-auto mb-4 grid size-12 place-items-center rounded-xl border border-white/10 bg-gradient-to-br from-fuchsia-500/10 to-indigo-500/10">
            <Icon className="size-5 text-fuchsia-300" />
          </div>
          <p className="font-medium">{title}</p>
          <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  )
}
