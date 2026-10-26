import { useMemo, useState } from 'react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis,
} from 'recharts'
import {
  CheckCircle2,
  Circle,
  Clock,
  Layers,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import {
  PRIORITIES,
  STATUSES,
} from '@/components/issues/issue-meta'
import { cn } from '@/lib/utils'

export default function IssuesDashboard({ issues = [], team }) {
  const [timeRange, setTimeRange] = useState('30d')

  // Real issue calculations
  const metrics = useMemo(() => {
    const total = issues.length
    const active = issues.filter((i) => ['in_progress', 'in_review'].includes(i.status)).length
    const todo = issues.filter((i) => ['todo', 'backlog'].includes(i.status)).length
    const done = issues.filter((i) => i.status === 'done').length
    const completionRate = total > 0 ? Math.round((done / total) * 100) : 0

    return { total, active, todo, done, completionRate }
  }, [issues])

  // Throughput: Created vs Resolved
  const throughputData = useMemo(() => {
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 14 : 30
    const result = []

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000)
      const dayStr = d.toISOString().slice(0, 10)
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

      const created = issues.filter((iss) => (iss.created_at || '').slice(0, 10) === dayStr).length
      const resolved = issues.filter((iss) => iss.status === 'done' && (iss.updated_at || iss.created_at || '').slice(0, 10) === dayStr).length

      result.push({
        date: label,
        created,
        resolved,
      })
    }
    return result
  }, [issues, timeRange])

  // Status breakdown
  const statusData = useMemo(() => {
    return STATUSES.map((s) => {
      const count = issues.filter((i) => i.status === s.id).length
      return {
        name: s.label,
        count,
        fill: s.color,
      }
    })
  }, [issues])

  // Priority breakdown
  const priorityData = useMemo(() => {
    const colors = {
      1: '#f97316',
      2: '#eab308',
      3: '#60a5fa',
      4: '#94a3b8',
      0: '#52525b',
    }
    return PRIORITIES.map((p) => {
      const count = issues.filter((i) => (i.priority ?? 0) === p.id).length
      return {
        priority: p.label,
        count,
        fill: colors[p.id] || '#52525b',
      }
    })
  }, [issues])

  // Assignee distribution
  const assigneeData = useMemo(() => {
    const map = new Map()
    issues.forEach((i) => {
      const name = i.assignee?.full_name || 'Unassigned'
      const cur = map.get(name) || { name, total: 0, done: 0, active: 0 }
      cur.total += 1
      if (i.status === 'done') cur.done += 1
      if (['in_progress', 'in_review'].includes(i.status)) cur.active += 1
      map.set(name, cur)
    })
    return Array.from(map.values())
  }, [issues])

  const chartConfigs = {
    throughput: {
      created: { label: 'Created', color: 'var(--chart-1)' },
      resolved: { label: 'Resolved', color: 'var(--chart-3)' },
    },
    status: {
      count: { label: 'Issues', color: 'var(--chart-1)' },
    },
    priority: {
      count: { label: 'Issues', color: 'var(--chart-4)' },
    },
  }

  return (
    <div className="space-y-6 px-4 py-3 md:px-6 md:py-4 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-subtle pb-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            {team?.name ?? 'Team'} Overview
          </h2>
          <p className="text-xs text-muted-foreground">
            Throughput, status distribution, and workload.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border border-subtle bg-white/[0.02] p-0.5 text-xs">
            {['7d', '30d', 'all'].map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => setTimeRange(range)}
                className={cn(
                  'rounded px-2.5 py-0.5 font-medium transition-colors',
                  timeRange === range
                    ? 'bg-white/10 text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {range === '7d' ? '7d' : range === '30d' ? '30d' : 'All'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="border-subtle bg-white/[0.02]">
          <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
            <CardTitle className="text-xs font-normal text-muted-foreground">Total</CardTitle>
            <Layers className="size-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-semibold tracking-tight text-foreground">{metrics.total}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">{metrics.todo} pending</p>
          </CardContent>
        </Card>

        <Card className="border-subtle bg-white/[0.02]">
          <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
            <CardTitle className="text-xs font-normal text-muted-foreground">In Progress</CardTitle>
            <Clock className="size-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-semibold tracking-tight text-foreground">{metrics.active}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Active execution</p>
          </CardContent>
        </Card>

        <Card className="border-subtle bg-white/[0.02]">
          <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
            <CardTitle className="text-xs font-normal text-muted-foreground">Todo / Backlog</CardTitle>
            <Circle className="size-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-semibold tracking-tight text-foreground">{metrics.todo}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Queued</p>
          </CardContent>
        </Card>

        <Card className="border-subtle bg-white/[0.02]">
          <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
            <CardTitle className="text-xs font-normal text-muted-foreground">Done</CardTitle>
            <CheckCircle2 className="size-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-semibold tracking-tight text-foreground">{metrics.done}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">{metrics.completionRate}% completion</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Throughput Chart */}
        <Card className="border-subtle bg-white/[0.02]">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-medium text-foreground">Issue Throughput</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <ChartContainer config={chartConfigs.throughput} className="h-56 w-full aspect-auto">
              <AreaChart data={throughputData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="fillCreated" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="fillResolved" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-3)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--chart-3)" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-subtle)" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} tick={{ fontSize: 11 }} />
                <YAxis tickLine={false} axisLine={false} allowDecimals={false} tickMargin={8} tick={{ fontSize: 11 }} />
                <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
                <Area
                  type="monotone"
                  dataKey="created"
                  stroke="var(--chart-1)"
                  strokeWidth={1.5}
                  fillOpacity={1}
                  fill="url(#fillCreated)"
                  name="Created"
                />
                <Area
                  type="monotone"
                  dataKey="resolved"
                  stroke="var(--chart-3)"
                  strokeWidth={1.5}
                  fillOpacity={1}
                  fill="url(#fillResolved)"
                  name="Resolved"
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Status Breakdown */}
        <Card className="border-subtle bg-white/[0.02]">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-medium text-foreground">Issues by Status</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <ChartContainer config={chartConfigs.status} className="h-56 w-full aspect-auto">
              <BarChart data={statusData} layout="vertical" margin={{ top: 5, right: 15, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-subtle)" />
                <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis
                  dataKey="name"
                  type="category"
                  tickLine={false}
                  axisLine={false}
                  width={85}
                  tick={{ fontSize: 11 }}
                />
                <ChartTooltip content={<ChartTooltipContent hideIndicator />} />
                <Bar dataKey="count" radius={[0, 3, 3, 0]}>
                  {statusData.map((entry, index) => (
                    <Cell key={`status-cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Charts: Priority & Assignees */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Priority Breakdown */}
        <Card className="border-subtle bg-white/[0.02]">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-medium text-foreground">Issues by Priority</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <ChartContainer config={chartConfigs.priority} className="h-48 w-full aspect-auto">
              <BarChart data={priorityData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-subtle)" />
                <XAxis dataKey="priority" tickLine={false} axisLine={false} tickMargin={8} tick={{ fontSize: 11 }} />
                <YAxis tickLine={false} axisLine={false} allowDecimals={false} tick={{ fontSize: 11 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                  {priorityData.map((entry, index) => (
                    <Cell key={`priority-cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Team Workload */}
        <Card className="border-subtle bg-white/[0.02]">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-medium text-foreground">Assignee Workload</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            {assigneeData.length === 0 ? (
              <div className="grid h-48 place-items-center text-xs text-muted-foreground">
                No assigned issues
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                {assigneeData.map((a) => {
                  const pct = a.total > 0 ? Math.round((a.done / a.total) * 100) : 0
                  return (
                    <div key={a.name} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-foreground">{a.name}</span>
                        <span className="text-muted-foreground">
                          {a.done}/{a.total} completed ({pct}%)
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-white/40 transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
