'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase, type SetRow, type Sponsor } from '@/lib/supabase'

const STATUS_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  live:          { bg: 'rgba(255,140,0,0.12)', color: '#ff8c00', border: 'rgba(255,140,0,0.4)' },
  running_late:  { bg: 'rgba(255,184,48,0.10)', color: '#ffb830', border: 'rgba(255,184,48,0.3)' },
  cancelled:     { bg: 'rgba(255,60,60,0.08)',  color: '#ff4444', border: 'rgba(255,60,60,0.2)' },
  scheduled:     { bg: 'transparent', color: 'rgba(255,255,255,0.35)', border: 'rgba(255,255,255,0.06)' },
}

export default function AdminPage() {
  const params = useParams()
  const token = params.token as string

  const [sets, setSets] = useState<SetRow[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [messageOk, setMessageOk] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)

  const [form, setForm] = useState({
    bandName: '',
    genre: '',
    address: '',
    startTime: '',
    endTime: '',
  })

  // Sponsors
  const [sponsors, setSponsors] = useState<Sponsor[]>([])
  const [showSponsorForm, setShowSponsorForm] = useState(false)
  const [sponsorMessage, setSponsorMessage] = useState('')
  const [sponsorMessageOk, setSponsorMessageOk] = useState(true)
  const [sponsorForm, setSponsorForm] = useState({ name: '', address: '', url: '' })

  // Derive genres from loaded sets
  const genres = Array.from(new Set(sets.map(s => s.acts?.genre).filter(Boolean) as string[])).sort()

  // Filtered + sorted sets: live/running_late first, then by search
  const visibleSets = sets
    .filter(s => !search || s.acts?.name?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const priority: Record<string, number> = { live: 0, running_late: 1, scheduled: 2, cancelled: 3 }
      return (priority[a.status] ?? 2) - (priority[b.status] ?? 2)
    })

  const liveSets = sets.filter(s => s.status === 'live' || s.status === 'running_late')

  function toISOWithDate(time: string) {
    return `2026-05-16T${time}:00-04:00`
  }

  useEffect(() => { loadSets(); loadSponsors() }, [])

  async function loadSets() {
    setLoading(true)
    const { data } = await supabase
      .from('sets')
      .select('*, venues(*), acts(*)')
      .order('starts_at')
    if (data) setSets(data)
    setLoading(false)
  }

  async function loadSponsors() {
    const { data } = await supabase.from('sponsors').select('*').order('created_at')
    if (data) setSponsors(data)
  }

  async function handleAddSponsor(e: React.FormEvent) {
    e.preventDefault()
    setSponsorMessage('saving...')
    setSponsorMessageOk(true)

    const res = await fetch('/api/admin/add-sponsor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify(sponsorForm),
    })

    const json = await res.json()
    if (!res.ok) {
      setSponsorMessage(json.error || 'something went wrong')
      setSponsorMessageOk(false)
      return
    }

    setSponsorMessage('added.')
    setSponsorForm({ name: '', address: '', url: '' })
    setShowSponsorForm(false)
    loadSponsors()
  }

  async function deleteSponsor(sponsorId: string) {
    if (!confirm('remove this sponsor?')) return
    await fetch('/api/admin/delete-sponsor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify({ sponsorId }),
    })
    loadSponsors()
  }

  async function handleAddSet(e: React.FormEvent) {
    e.preventDefault()
    setMessage('saving...')
    setMessageOk(true)

    const res = await fetch('/api/admin/add-set', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
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
    setForm({ bandName: '', genre: '', address: '', startTime: '', endTime: '' })
    setShowForm(false)
    loadSets()
  }

  async function updateStatus(setId: string, status: string) {
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
      loadSets()
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
    <div style={{ minHeight: '100vh', background: '#0a0a0f', padding: '32px 20px', fontFamily: "'JetBrains Mono', monospace" }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 28, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff8c00', display: 'inline-block', boxShadow: '0 0 8px #ff8c00' }} />
              <span style={{ color: '#ff8c00', fontSize: 13, letterSpacing: '0.1em' }}>PULSED admin</span>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11 }}>virginia highland porchfest 2026 — may 16</p>
          </div>
          <a href="/" style={{ color: '#ff8c00', fontSize: 12, textDecoration: 'none', opacity: 0.7, marginTop: 2 }}>
            → public map
          </a>
        </div>

        {/* Live now summary bar */}
        {liveSets.length > 0 && (
          <div style={{
            background: 'rgba(255,140,0,0.1)',
            border: '1px solid rgba(255,140,0,0.25)',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 20,
            fontSize: 12,
            color: '#ff8c00',
          }}>
            ● {liveSets.length} live now: {liveSets.map(s => s.acts?.name).join(', ')}
          </div>
        )}

        {/* Sponsors section */}
        <div style={{ marginBottom: 24, paddingBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.05em' }}>
              sponsors
              {sponsors.length > 0 && (
                <span style={{ color: '#ff8c00', marginLeft: 8 }}>● {sponsors.length} active</span>
              )}
            </div>
            <button
              onClick={() => { setShowSponsorForm(f => !f); setSponsorMessage('') }}
              style={{
                background: showSponsorForm ? 'rgba(255,255,255,0.08)' : 'rgba(255,140,0,0.15)',
                color: showSponsorForm ? 'rgba(255,255,255,0.6)' : '#ff8c00',
                border: `1px solid ${showSponsorForm ? 'rgba(255,255,255,0.08)' : 'rgba(255,140,0,0.3)'}`,
                borderRadius: 6,
                padding: '7px 14px',
                fontFamily: 'inherit',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {showSponsorForm ? 'cancel' : '+ add sponsor'}
            </button>
          </div>

          {/* Add sponsor form */}
          {showSponsorForm && (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 20, marginBottom: 16 }}>
              <form onSubmit={handleAddSponsor} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={labelStyle}>bar name</label>
                  <input required style={inputStyle} placeholder="Dark Horse Tavern"
                    value={sponsorForm.name} onChange={e => setSponsorForm({ ...sponsorForm, name: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>address</label>
                  <input required style={inputStyle} placeholder="816 N Highland Ave NE"
                    value={sponsorForm.address} onChange={e => setSponsorForm({ ...sponsorForm, address: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>website (optional)</label>
                  <input style={inputStyle} placeholder="https://darkhorseatlanta.com"
                    value={sponsorForm.url} onChange={e => setSponsorForm({ ...sponsorForm, url: e.target.value })} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <button type="submit" style={{
                    background: '#ff8c00', color: '#0a0a0f', border: 'none', borderRadius: 6,
                    padding: '9px 20px', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}>
                    add sponsor
                  </button>
                  {sponsorMessage && (
                    <span style={{ fontSize: 12, color: sponsorMessageOk ? 'rgba(255,255,255,0.35)' : '#ff4444' }}>
                      {sponsorMessage}
                    </span>
                  )}
                </div>
              </form>
            </div>
          )}

          {/* Sponsor list */}
          {sponsors.length === 0 ? (
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>no sponsors yet</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {sponsors.map(sponsor => (
                <div key={sponsor.id} style={{
                  background: 'rgba(255,140,0,0.06)', border: '1px solid rgba(255,140,0,0.2)',
                  borderRadius: 8, padding: '10px 14px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: '#ff8c00', fontWeight: 600, marginBottom: 2 }}>{sponsor.name}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>
                      {sponsor.address}
                      {sponsor.url && (
                        <a href={sponsor.url} target="_blank" rel="noopener noreferrer"
                          style={{ color: 'rgba(255,140,0,0.5)', marginLeft: 8, textDecoration: 'none' }}>
                          {sponsor.url.replace('https://', '')}
                        </a>
                      )}
                    </div>
                  </div>
                  <button onClick={() => deleteSponsor(sponsor.id)}
                    style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.15)', cursor: 'pointer', fontSize: 14, padding: 4, lineHeight: 1 }}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Search + add button row */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <input
            type="search"
            placeholder="search bands..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              ...inputStyle,
              flex: 1,
              padding: '10px 14px',
              fontSize: 13,
            }}
          />
          <button
            onClick={() => { setShowForm(f => !f); setMessage('') }}
            style={{
              background: showForm ? 'rgba(255,255,255,0.08)' : '#ff8c00',
              color: showForm ? 'rgba(255,255,255,0.6)' : '#0a0a0f',
              border: 'none',
              borderRadius: 6,
              padding: '10px 18px',
              fontFamily: 'inherit',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {showForm ? 'cancel' : '+ add set'}
          </button>
        </div>

        {/* Collapsible add set form */}
        {showForm && (
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 24, marginBottom: 20 }}>
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
                <input
                  required
                  list="genre-list"
                  style={inputStyle}
                  placeholder="pick or type a genre"
                  value={form.genre}
                  onChange={e => setForm({ ...form, genre: e.target.value })}
                />
                <datalist id="genre-list">
                  {genres.map(g => <option key={g} value={g} />)}
                </datalist>
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>start time</label>
                  <input required type="time" style={{ ...inputStyle, colorScheme: 'dark' }} value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>end time</label>
                  <input required type="time" style={{ ...inputStyle, colorScheme: 'dark' }} value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <button
                  type="submit"
                  style={{
                    background: '#ff8c00', color: '#0a0a0f', border: 'none', borderRadius: 6,
                    padding: '10px 24px', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer',
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
        )}

        {/* Sets list */}
        <div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', marginBottom: 12, letterSpacing: '0.05em' }}>
            {search ? `${visibleSets.length} of ${sets.length} sets` : `${sets.length} sets`}
            {liveSets.length > 0 && !search && <span style={{ color: '#ff8c00', marginLeft: 10 }}>● {liveSets.length} live</span>}
          </div>

          {loading ? (
            <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>loading...</p>
          ) : visibleSets.length === 0 ? (
            <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>no sets match "{search}"</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {visibleSets.map(set => {
                const sc = STATUS_COLORS[set.status] || STATUS_COLORS.scheduled
                const isLive = set.status === 'live' || set.status === 'running_late'
                return (
                  <div key={set.id} style={{
                    background: sc.bg,
                    border: `1px solid ${sc.border}`,
                    borderRadius: 8,
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    ...(isLive ? { boxShadow: `0 0 0 1px ${sc.border}` } : {}),
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, color: isLive ? '#fff' : 'rgba(255,255,255,0.75)', marginBottom: 3, fontWeight: isLive ? 600 : 400 }}>
                        {set.acts?.name}
                      </div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>
                        {new Date(set.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {' – '}
                        {new Date(set.ends_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        <span style={{ marginLeft: 8 }}>{set.acts?.genre}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <select
                        style={{
                          background: 'rgba(255,255,255,0.05)',
                          border: `1px solid ${sc.border}`,
                          borderRadius: 4,
                          padding: '6px 8px',
                          color: sc.color,
                          fontFamily: 'inherit',
                          fontSize: 11,
                          cursor: 'pointer',
                          colorScheme: 'dark',
                        }}
                        value={set.status}
                        onChange={e => {
                          const next = e.target.value
                          if (next === 'cancelled') {
                            if (!confirm(`Cancel "${set.acts?.name}"? This will show them as cancelled on the public map.`)) return
                          }
                          updateStatus(set.id, next)
                        }}
                      >
                        <option value="scheduled">scheduled</option>
                        <option value="live">live</option>
                        <option value="running_late">running late</option>
                        <option value="cancelled">cancelled</option>
                      </select>
                      <button
                        onClick={() => deleteSet(set.id)}
                        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.15)', cursor: 'pointer', fontSize: 14, padding: 4, lineHeight: 1 }}
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


      </div>
    </div>
  )
}
