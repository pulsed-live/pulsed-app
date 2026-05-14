import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'

// ─── Event registry ────────────────────────────────────────────────────────────
// Add new events here as Pulsed grows.
const EVENT_CONFIG: Record<string, {
  name: string
  shortName: string
  date: string
  location: string
  startUtc: string
  endUtc: string
}> = {
  vhpf2026: {
    name: 'Virginia-Highland Porchfest 2026',
    shortName: 'VH Porchfest',
    date: 'May 16, 2026',
    location: 'Virginia-Highland, Atlanta, GA',
    startUtc: '2026-05-16T04:00:00Z',
    endUtc:   '2026-05-17T04:00:00Z',
  },
}

const SLOT_LABELS: Record<number, string> = {
  14: '10 AM', 15: '11 AM', 16: '12 PM', 17: '1 PM',
  18: '2 PM',  19: '3 PM',  20: '4 PM',  21: '5 PM',
  22: '6 PM',  23: '7 PM',   0: '8 PM',
}

// ─── Data types ────────────────────────────────────────────────────────────────

type ViewRow = {
  ts: string
  is_mobile: boolean
}
type SetRow = {
  id: string
  starts_at: string
  ends_at: string
  status: 'scheduled' | 'live' | 'running_late' | 'cancelled'
  venues: { name: string } | null
  acts: { name: string } | null
}

// ─── Data fetching ─────────────────────────────────────────────────────────────
function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

async function getViews(eventId: string, startUtc: string, endUtc: string): Promise<ViewRow[]> {
  const { data } = await getClient()
    .from('page_views')
    .select('ts, is_mobile')
    .eq('event_id', eventId)
    .gte('ts', startUtc)
    .lt('ts', endUtc)
  return (data ?? []) as ViewRow[]
}

async function getSets(startUtc: string, endUtc: string): Promise<SetRow[]> {
  const client = getClient()
  const { data, error } = await client
    .from('sets')
    .select('id, starts_at, ends_at, status, venues(name), acts(name)')
    .gte('starts_at', startUtc)
    .lt('starts_at', endUtc)
    .order('starts_at')

  if (error) throw error
  return (data ?? []) as unknown as SetRow[]
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function utcHour(isoString: string): number {
  return new Date(isoString).getUTCHours()
}

function slotLabel(hour: number): string {
  return SLOT_LABELS[hour] ?? `${hour}:00 UTC`
}

function groupBySlot(sets: SetRow[]): Map<number, SetRow[]> {
  const map = new Map<number, SetRow[]>()
  for (const s of sets) {
    const h = utcHour(s.starts_at)
    if (!map.has(h)) map.set(h, [])
    map.get(h)!.push(s)
  }
  return map
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default async function StatsPage({
  params,
}: {
  params: Promise<{ eventId: string }>
}) {
  const { eventId } = await params
  const event = EVENT_CONFIG[eventId]
  if (!event) notFound()

  const [sets, views] = await Promise.all([
    getSets(event.startUtc, event.endUtc),
    getViews(eventId, event.startUtc, event.endUtc),
  ])
  const bySlot = groupBySlot(sets)

  // Visitor stats
  const totalVisitors = views.length
  const mobileCount = views.filter(v => v.is_mobile).length
  const mobilePct = totalVisitors > 0 ? Math.round((mobileCount / totalVisitors) * 100) : 0

  // Peak hour (EDT = UTC-4)
  const hourCounts: Record<number, number> = {}
  for (const v of views) {
    const edtHour = (new Date(v.ts).getUTCHours() - 4 + 24) % 24
    hourCounts[edtHour] = (hourCounts[edtHour] ?? 0) + 1
  }
  const peakEdtHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]
  const peakLabel = peakEdtHour
    ? `${parseInt(peakEdtHour[0]) % 12 || 12} ${parseInt(peakEdtHour[0]) < 12 ? 'AM' : 'PM'}`
    : null
  const slots = [...bySlot.keys()].sort((a, b) => {
    // treat hour 0 (8 PM EDT) as coming after 23
    const normalize = (h: number) => h === 0 ? 24 : h
    return normalize(a) - normalize(b)
  })

  const totalActs = sets.length
  const totalSlots = slots.length
  const uniqueVenues = new Set(sets.map(s => s.venues?.name).filter(Boolean)).size
  const cancelledCount = sets.filter(s => s.status === 'cancelled').length

  const maxPerSlot = Math.max(...slots.map(h => bySlot.get(h)!.length))

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0f',
      color: '#f0f0f0',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>

      {/* ── Header ── */}
      <div style={{
        borderBottom: '1px solid #1e1e2e',
        padding: '28px 24px 24px',
        maxWidth: 720,
        margin: '0 auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
            color: '#ff8c00', textTransform: 'uppercase',
          }}>
            Powered by Pulsed
          </span>
          <span style={{ color: '#333', fontSize: 11 }}>·</span>
          <a
            href="https://map.pulsedapp.live"
            style={{ fontSize: 11, color: '#666', textDecoration: 'none' }}
          >
            Open live map →
          </a>
        </div>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, lineHeight: 1.2, color: '#fff' }}>
          {event.name}
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: '#888' }}>
          {event.date} · {event.location}
        </p>
      </div>

      {/* ── Big stat cards ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 12,
        padding: '24px 24px 0',
        maxWidth: 720,
        margin: '0 auto',
      }}>
        {[
          { label: 'Total Acts', value: totalActs },
          { label: 'Venues', value: uniqueVenues },
          { label: 'Time Slots', value: totalSlots },
        ].map(({ label, value }) => (
          <div key={label} style={{
            background: '#12121c',
            border: '1px solid #1e1e2e',
            borderRadius: 12,
            padding: '20px 16px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 36, fontWeight: 800, color: '#ff8c00', lineHeight: 1 }}>
              {value}
            </div>
            <div style={{ fontSize: 12, color: '#666', marginTop: 6, fontWeight: 500 }}>
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* ── Visitor stats (only shown once data exists) ── */}
      {totalVisitors > 0 && (
        <div style={{
          padding: '20px 24px 0',
          maxWidth: 720,
          margin: '0 auto',
        }}>
          <h2 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            App opens on event day
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {[
              { label: 'People opened the app', value: totalVisitors.toLocaleString() },
              { label: 'On mobile', value: `${mobilePct}%` },
              { label: 'Peak hour', value: peakLabel ?? '—' },
            ].map(({ label, value }) => (
              <div key={label} style={{
                background: '#0d1a0d',
                border: '1px solid #1a2e1a',
                borderRadius: 12,
                padding: '16px 14px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#4caf50', lineHeight: 1 }}>
                  {value}
                </div>
                <div style={{ fontSize: 11, color: '#555', marginTop: 5, fontWeight: 500 }}>
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Acts per time slot bar chart ── */}
      <div style={{
        padding: '28px 24px 0',
        maxWidth: 720,
        margin: '0 auto',
      }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 13, fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Acts per time slot
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {slots.map(hour => {
            const count = bySlot.get(hour)!.length
            const pct = Math.round((count / maxPerSlot) * 100)
            return (
              <div key={hour} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 44, fontSize: 12, color: '#888', textAlign: 'right', flexShrink: 0 }}>
                  {slotLabel(hour)}
                </div>
                <div style={{ flex: 1, background: '#1a1a2e', borderRadius: 4, height: 24, overflow: 'hidden' }}>
                  <div style={{
                    width: `${pct}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #ff8c00, #e07000)',
                    borderRadius: 4,
                    transition: 'width 0.3s ease',
                    display: 'flex',
                    alignItems: 'center',
                    paddingLeft: 8,
                    minWidth: 28,
                  }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#000' }}>{count}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Full lineup by slot ── */}
      <div style={{
        padding: '32px 24px 48px',
        maxWidth: 720,
        margin: '0 auto',
      }}>
        <h2 style={{ margin: '0 0 20px', fontSize: 13, fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Full lineup
        </h2>

        {slots.map(hour => (
          <div key={hour} style={{ marginBottom: 32 }}>
            <div style={{
              fontSize: 12,
              fontWeight: 700,
              color: '#ff8c00',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              marginBottom: 10,
              paddingBottom: 8,
              borderBottom: '1px solid #1e1e2e',
            }}>
              {slotLabel(hour)}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {bySlot.get(hour)!.map(set => {
                const isCancelled = set.status === 'cancelled'
                return (
                  <div key={set.id} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: '#0f0f1a',
                    opacity: isCancelled ? 0.4 : 1,
                  }}>
                    <div>
                      <span style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: isCancelled ? '#666' : '#f0f0f0',
                        textDecoration: isCancelled ? 'line-through' : 'none',
                      }}>
                        {set.acts?.name ?? '—'}
                      </span>
                      {isCancelled && (
                        <span style={{ fontSize: 10, color: '#e03c3c', marginLeft: 8, fontWeight: 600 }}>
                          CANCELLED
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 12, color: '#555', maxWidth: 180, textAlign: 'right' }}>
                      {set.venues?.name ?? '—'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {cancelledCount > 0 && (
          <p style={{ fontSize: 12, color: '#444', marginTop: 8 }}>
            {cancelledCount} act{cancelledCount !== 1 ? 's' : ''} cancelled
          </p>
        )}
      </div>

      {/* ── Footer ── */}
      <div style={{
        borderTop: '1px solid #1e1e2e',
        padding: '20px 24px',
        maxWidth: 720,
        margin: '0 auto',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ fontSize: 12, color: '#444' }}>
          Real-time data via Pulsed
        </span>
        <a
          href="https://map.pulsedapp.live"
          style={{
            fontSize: 12,
            color: '#ff8c00',
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          Open live map →
        </a>
      </div>

    </div>
  )
}

// ─── Metadata ──────────────────────────────────────────────────────────────────
export async function generateMetadata({
  params,
}: {
  params: Promise<{ eventId: string }>
}) {
  const { eventId } = await params
  const event = EVENT_CONFIG[eventId]
  if (!event) return {}
  return {
    title: `${event.shortName} — Stats | Pulsed`,
    description: `Live music stats for ${event.name} on ${event.date} in ${event.location}.`,
  }
}
