'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase, type Venue, type Act, type SetRow } from '@/lib/supabase'

const GENRES = ['Rock', 'Jazz', 'Blues', 'Folk', 'Country', 'EDM', 'Hip-Hop', 'Classical', 'Indie', 'Other']

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  live:          { bg: 'rgba(255,140,0,0.15)', color: '#ff8c00' },
  running_late:  { bg: 'rgba(255,184,48,0.15)', color: '#ffb830' },
  cancelled:     { bg: 'rgba(255,60,60,0.15)',  color: '#ff4444' },
  scheduled:     { bg: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.35)' },
}

export default function AdminPage() {
  const params = useParams()
  const token = params.token as string

  const [sets, setSets] = useState<SetRow[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [messageOk, setMessageOk] = useState(true)

  const [form, setForm] = useState({
    bandName: '',
    genre: 'Rock',
    address: '',
    startTime: '',
    endTime: '',
  })

  // All sets are on May 16, 2026 — prepend the date to a time string
  function toISOWithDate(time: string) {
    return `2026-05-16T${time}:00`
  }

  useEffect(() => { loadSets() }, [])

  async function loadSets() {
    setLoading(true)
    const { data } = await supabase
      .from('sets')
      .select('*, venues(*), acts(*)')
      .order('starts_at')
    if (data) setSets(data)
    setLoading(false)
  }

  async function handleAddSet(e: React.FormEvent) {
    e.preventDefault()
    setMessage('saving...')
    setMessageOk(true)

    const res = await fetch('/api/admin/add-set', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': token,
      },
      body: JSON.stringify({
        ...form,
        startTime: toISOWithDate(form.startTime),
        endTime: toISOWithDate(form.endTime),
      }),
    })

    const json = await res.json()

    if (!res.ok) {
      setMessage(json.error || 'something went wrong')
      setMessageOk(false)
      return
    }

    setMessage('added.')
    setForm({ bandName: '', genre: 'Rock', address: '', startTime: '', endTime: '' })
    loadSets()
  }

  async function updateStatus(setId: string, status: string) {
    // Optimistic update so the dropdown doesn't snap back
    setSets(prev => prev.map(s => s.id === setId ? { ...s, status: status as SetRow['status'] } : s))

    const res = await fetch('/api/admin/update-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify({ setId, status }),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      setMessage(json.error || `update failed (${res.status})`)
      setMessageOk(false)
      loadSets() // revert to real DB state on failure
      return
    }
    loadSets()
  }

  async function deleteSet(setId: string) {
    if (!confirm('delete this set?')) return
    await fetch('/api/admin/delete-set', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify({ setId }),
    })
    loadSets()
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 6,
    padding: '10px 12px',
    color: 'rgba(255,255,255,0.85)',
    fontFamily: 'inherit',
    fontSize: 13,
    outline: 'none',
    appearance: 'none',
    WebkitAppearance: 'none',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    marginBottom: 6,
    letterSpacing: '0.05em',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', padding: '40px 24px', fontFamily: "'JetBrains Mono', monospace" }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff8c00', display: 'inline-block', boxShadow: '0 0 8px #ff8c00' }} />
            <span style={{ color: '#ff8c00', fontSize: 13, letterSpacing: '0.1em' }}>PULSED</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 400, color: 'rgba(255,255,255,0.85)', marginBottom: 4 }}>admin</h1>
          <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12 }}>virginia highland porchfest 2026 — may 16</p>
        </div>

        {/* Add Set Form */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 28, marginBottom: 32 }}>
          <h2 style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 24, letterSpacing: '0.05em' }}>add a set</h2>

          <form onSubmit={handleAddSet} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={labelStyle}>band name</label>
              <input
                required
                style={inputStyle}
                placeholder="the midnight collective"
                value={form.bandName}
                onChange={e => setForm({ ...form, bandName: e.target.value })}
              />
            </div>

            <div>
              <label style={labelStyle}>genre</label>
              <select
                style={{ ...inputStyle, cursor: 'pointer' }}
                value={form.genre}
                onChange={e => setForm({ ...form, genre: e.target.value })}
              >
                {GENRES.map(g => <option key={g} style={{ background: '#0a0a0f' }}>{g}</option>)}
              </select>
            </div>

            <div>
              <label style={labelStyle}>porch address</label>
              <input
                required
                style={inputStyle}
                placeholder="800 n highland ave ne"
                value={form.address}
                onChange={e => setForm({ ...form, address: e.target.value })}
              />
            </div>

            <div>
              <label style={labelStyle}>start time</label>
              <input
                required
                type="time"
                style={{ ...inputStyle, colorScheme: 'dark' }}
                value={form.startTime}
                onChange={e => setForm({ ...form, startTime: e.target.value })}
              />
            </div>

            <div>
              <label style={labelStyle}>end time</label>
              <input
                required
                type="time"
                style={{ ...inputStyle, colorScheme: 'dark' }}
                value={form.endTime}
                onChange={e => setForm({ ...form, endTime: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingTop: 4 }}>
              <button
                type="submit"
                style={{
                  background: '#ff8c00',
                  color: '#0a0a0f',
                  border: 'none',
                  borderRadius: 6,
                  padding: '10px 24px',
                  fontFamily: 'inherit',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  letterSpacing: '0.05em',
                }}
              >
                add set
              </button>
              {message && (
                <span style={{ fontSize: 12, color: messageOk ? 'rgba(255,255,255,0.35)' : '#ff4444' }}>
                  {message}
                </span>
              )}
            </div>
          </form>
        </div>

        {/* Sets List */}
        <div>
          <h2 style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginBottom: 16, letterSpacing: '0.05em' }}>
            all sets ({sets.length})
          </h2>

          {loading ? (
            <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>loading...</p>
          ) : sets.length === 0 ? (
            <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>no sets yet. add one above.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sets.map(set => {
                const sc = STATUS_COLORS[set.status] || STATUS_COLORS.scheduled
                return (
                  <div key={set.id} style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 8,
                    padding: '14px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 16,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', marginBottom: 4 }}>
                        {set.acts?.name}
                      </div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 2 }}>
                        {set.venues?.address} · {set.acts?.genre}
                      </div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>
                        {new Date(set.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {' – '}
                        {new Date(set.ends_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                      <span style={{
                        fontSize: 10,
                        padding: '3px 10px',
                        borderRadius: 20,
                        background: sc.bg,
                        color: sc.color,
                        letterSpacing: '0.05em',
                      }}>
                        {set.status.replace('_', ' ')}
                      </span>
                      <select
                        style={{
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: 4,
                          padding: '4px 8px',
                          color: 'rgba(255,255,255,0.5)',
                          fontFamily: 'inherit',
                          fontSize: 11,
                          cursor: 'pointer',
                          colorScheme: 'dark',
                        }}
                        value={set.status}
                        onChange={e => updateStatus(set.id, e.target.value)}
                      >
                        <option value="scheduled">scheduled</option>
                        <option value="live">live</option>
                        <option value="running_late">running late</option>
                        <option value="cancelled">cancelled</option>
                      </select>
                      <button
                        onClick={() => deleteSet(set.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'rgba(255,255,255,0.2)',
                          cursor: 'pointer',
                          fontSize: 14,
                          padding: 4,
                          lineHeight: 1,
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer link to map */}
        <div style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <a href="/map" style={{ color: '#ff8c00', fontSize: 12, textDecoration: 'none', opacity: 0.7 }}>
            → view public map
          </a>
        </div>
      </div>
    </div>
  )
}
