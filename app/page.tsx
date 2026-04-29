'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase, type SetRow, type Sponsor } from '@/lib/supabase'

const STATUS_COLORS: Record<string, string> = {
  cancelled: '#e03c3c',
  scheduled: '#888',
}

// Official VHDA time-slot colors (from PF_Colors-ForKent.pdf)
// One earthy, distinct hue per UTC hour (EDT = UTC-4)
const SLOT_COLORS: Record<number, string> = {
  14: '#81817f', // 10 AM EDT — warm gray
  15: '#619cab', // 11 AM EDT — teal-blue
  16: '#c25534', // 12 PM EDT — brick red
  17: '#619882', // 1 PM EDT  — teal-green
  18: '#7A525B', // 2 PM EDT  — dusty purple
  19: '#C17C2E', // 3 PM EDT  — gold
  20: '#426368', // 4 PM EDT  — dark navy
  21: '#787342', // 5 PM EDT  — olive
  23: '#1b2424', // 7 PM EDT  — near-black
}

function slotColor(set: SetRow): string {
  const utcHour = new Date(set.starts_at).getUTCHours()
  return SLOT_COLORS[utcHour] ?? '#ff8c00'
}

function pinColor(set: SetRow): string {
  const es = effectiveStatus(set)
  if (es === 'live' || es === 'running_late') return slotColor(set)
  return STATUS_COLORS[es] ?? '#888'
}

const STATUS_LABEL: Record<string, string> = {
  live: 'live now',
  running_late: 'running late',
  cancelled: 'cancelled',
  scheduled: 'scheduled',
}

function isNowPlaying(set: SetRow) {
  const now = Date.now()
  return now >= new Date(set.starts_at).getTime() && now <= new Date(set.ends_at).getTime()
}

// Derives display status from DB status + current time.
// Manual overrides (cancelled, running_late) always win.
// Otherwise, live window is computed from starts_at/ends_at.
function effectiveStatus(set: SetRow): SetRow['status'] {
  if (set.status === 'cancelled') return 'cancelled'
  if (set.status === 'running_late') return 'running_late'
  if (isNowPlaying(set)) return 'live'
  return set.status
}

// VHDA design tokens
const IVORY = 'rgba(233,232,228,0.94)'
const IVORY_BORDER = 'rgba(66,99,104,0.14)'
const IVORY_SHADOW = '0 2px 16px rgba(66,99,104,0.22), 0 1px 4px rgba(66,99,104,0.12)'
const NAVY_TEXT = 'rgba(66,99,104,0.55)'

export default function MapPage() {
  const mapRef = useRef<HTMLDivElement>(null)
  const leafletMap = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const [sets, setSets] = useState<SetRow[]>([])
  const [sponsors, setSponsors] = useState<Sponsor[]>([])
  const [selected, setSelected] = useState<SetRow | null>(null)
  const [selectedSponsor, setSelectedSponsor] = useState<Sponsor | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [filterLive, setFilterLive] = useState(false)
  const [filterGenre, setFilterGenre] = useState<string | null>(null)

  // Unique sorted genres from loaded sets
  const genres = Array.from(new Set(sets.map(s => s.acts?.genre).filter(Boolean) as string[])).sort()

  // Sets visible on map after filters applied
  const filteredSets = sets.filter(set => {
    if (filterLive && !isNowPlaying(set)) return false
    if (filterGenre && set.acts?.genre !== filterGenre) return false
    return true
  })

  // Load sets from Supabase
  async function loadSets() {
    const { data } = await supabase
      .from('sets')
      .select('*, venues(*), acts(*)')
      .order('starts_at')
    if (data) {
      setSets(data)
      setSelected(prev => prev ? (data.find(s => s.id === prev.id) ?? prev) : null)
    }
  }

  async function loadSponsors() {
    const { data } = await supabase.from('sponsors').select('*').order('created_at')
    if (data) setSponsors(data)
  }

  // Clear selection when it gets filtered out
  useEffect(() => {
    if (!selected) return
    const stillVisible = filteredSets.some(s => s.id === selected.id)
    if (!stillVisible) setSelected(null)
  }, [filterLive, filterGenre])

  // Init map once
  useEffect(() => {
    if (leafletMap.current) return

    import('leaflet').then(L => {
      if (!mapRef.current || leafletMap.current) return

      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      const map = L.map(mapRef.current!, {
        center: [33.7838, -84.3647],
        zoom: 16,
        zoomControl: false,
      })

      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap © CARTO',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map)

      L.control.zoom({ position: 'bottomright' }).addTo(map)

      // GPS dot
      let locationMarker: any = null
      let accuracyCircle: any = null

      map.on('locationfound', (e: any) => {
        if (locationMarker) locationMarker.remove()
        if (accuracyCircle) accuracyCircle.remove()

        accuracyCircle = L.circle(e.latlng, {
          radius: e.accuracy / 2,
          color: '#619882',
          fillColor: '#619882',
          fillOpacity: 0.08,
          weight: 1,
        }).addTo(map)

        const dot = L.divIcon({
          className: '',
          html: `<div style="
            width: 14px;
            height: 14px;
            border-radius: 50%;
            background: #619882;
            border: 2.5px solid #fff;
            box-shadow: 0 0 0 2px #619882, 0 2px 6px rgba(0,0,0,0.25);
          "></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        })

        locationMarker = L.marker(e.latlng, { icon: dot, zIndexOffset: 1000 }).addTo(map)
      })

      map.locate({ watch: true, enableHighAccuracy: true })

      leafletMap.current = map
      setLoaded(true)
    })

    return () => {
      if (leafletMap.current) {
        leafletMap.current.remove()
        leafletMap.current = null
      }
    }
  }, [])

  // Load sets + sponsors on mount; poll sets every 30s; real-time for both
  useEffect(() => {
    loadSets()
    loadSponsors()
    const interval = setInterval(loadSets, 30000)

    const setsChannel = supabase
      .channel('sets-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sets' }, () => {
        loadSets()
      })
      .subscribe()

    const sponsorsChannel = supabase
      .channel('sponsors-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sponsors' }, () => {
        loadSponsors()
      })
      .subscribe()

    return () => {
      clearInterval(interval)
      supabase.removeChannel(setsChannel)
      supabase.removeChannel(sponsorsChannel)
    }
  }, [])

  // Update markers when sets or filters change
  useEffect(() => {
    if (!loaded || !leafletMap.current) return

    import('leaflet').then(L => {
      markersRef.current.forEach(m => m.remove())
      markersRef.current = []

      // Group filtered sets by venue
      const byVenue = new Map<string, SetRow[]>()
      filteredSets.forEach(set => {
        if (!set.venues) return
        if (!byVenue.has(set.venue_id)) byVenue.set(set.venue_id, [])
        byVenue.get(set.venue_id)!.push(set)
      })

      byVenue.forEach((venueSets) => {
        const venue = venueSets[0].venues!
        if (!venue.lat || !venue.lng) return

        const statusPriority = ['live', 'running_late', 'scheduled', 'cancelled']
        const topSet = venueSets.sort((a, b) =>
          statusPriority.indexOf(effectiveStatus(a)) - statusPriority.indexOf(effectiveStatus(b))
        )[0]

        const color = pinColor(topSet)
        const isCancelled = effectiveStatus(topSet) === 'cancelled'
        const isLive = effectiveStatus(topSet) === 'live'

        const icon = L.divIcon({
          className: '',
          html: `
            <div style="position: relative; width: 14px; height: 14px; overflow: visible;">
              ${isLive ? `
              <div style="
                position: absolute;
                top: 0; left: 0;
                width: 14px; height: 14px;
                border-radius: 50%;
                border: 2px solid ${color};
                animation: liveRipple 2s ease-out infinite;
                pointer-events: none;
              "></div>` : ''}
              <div style="
                position: relative;
                z-index: 1;
                width: 14px;
                height: 14px;
                border-radius: 50%;
                background: ${color};
                border: 2px solid ${color};
                box-shadow: ${isCancelled ? 'none' : `0 0 10px ${color}88, 0 0 20px ${color}44`};
                opacity: ${isCancelled ? '0.55' : '1'};
                cursor: pointer;
              "></div>
            </div>
          `,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        })

        const marker = L.marker([venue.lat, venue.lng], { icon })
          .addTo(leafletMap.current)
          .on('click', () => { setSelected(venueSets[0]); setSelectedSponsor(null) })

        markersRef.current.push(marker)
      })

      // Sponsor pins — always visible, not affected by filters
      sponsors.forEach(sponsor => {
        const sponsorIcon = L.divIcon({
          className: '',
          html: `
            <div style="position: relative; text-align: center; width: 44px; margin-left: -11px;">
              <div class="sponsor-pin" style="
                width: 22px;
                height: 22px;
                border-radius: 50%;
                background: #ff8c00;
                border: 3px solid #fff;
                cursor: pointer;
                margin: 0 auto;
              "></div>
              <div style="
                margin-top: 4px;
                font-size: 8px;
                font-family: 'JetBrains Mono', monospace;
                font-weight: 600;
                color: #ff8c00;
                background: rgba(233,232,228,0.95);
                padding: 2px 5px;
                border-radius: 4px;
                white-space: nowrap;
                letter-spacing: 0.02em;
                display: inline-block;
              ">${sponsor.name}</div>
            </div>
          `,
          iconSize: [44, 44],
          iconAnchor: [22, 11],
        })

        const marker = L.marker([sponsor.lat, sponsor.lng], { icon: sponsorIcon, zIndexOffset: 500 })
          .addTo(leafletMap.current)
          .on('click', () => { setSelectedSponsor(sponsor); setSelected(null) })

        markersRef.current.push(marker)
      })
    })
  }, [filteredSets, loaded, sponsors])

  const pillBase: React.CSSProperties = {
    flexShrink: 0,
    fontSize: 12,
    padding: '10px 16px',
    borderRadius: 20,
    cursor: 'pointer',
    fontFamily: 'inherit',
    letterSpacing: '0.04em',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s ease',
    minHeight: 40,
    display: 'inline-flex',
    alignItems: 'center',
  }

  const panelBase: React.CSSProperties = {
    background: IVORY,
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
    border: `1px solid ${IVORY_BORDER}`,
    borderRadius: 10,
    boxShadow: IVORY_SHADOW,
  }

  const livePinCount = sets.filter(s => effectiveStatus(s) === 'live').length

  return (
    <>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600&display=swap" rel="stylesheet" />
      <style>{`
        @keyframes liveRipple {
          0%   { transform: scale(1);   opacity: 0.7; }
          100% { transform: scale(3.2); opacity: 0;   }
        }
        /* Raise zoom controls above filter bar */
        .leaflet-bottom.leaflet-right { bottom: 68px !important; right: 12px !important; }
        /* Style attribution to match VHDA brand */
        .leaflet-control-attribution {
          font-family: 'JetBrains Mono', monospace !important;
          font-size: 8px !important;
          color: rgba(66,99,104,0.45) !important;
          background: rgba(233,232,228,0.82) !important;
          border-top: none !important;
          padding: 3px 8px !important;
          border-radius: 6px 0 0 0 !important;
        }
        .leaflet-control-attribution a { color: rgba(66,99,104,0.55) !important; }
        /* Hide filter scrollbar */
        .filter-scroll::-webkit-scrollbar { display: none; }
        .filter-scroll { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      <div style={{ position: 'relative', width: '100vw', height: '100vh', background: '#E9E8E4', fontFamily: "'JetBrains Mono', monospace" }}>

        {/* Map */}
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

        {/* ── Header — top left ── */}
        <div style={{
          position: 'absolute', top: 14, left: 14, zIndex: 1000,
          ...panelBase,
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 16px',
        }}>
          {/* PULSED brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: '#ff8c00', display: 'inline-block',
              boxShadow: '0 0 10px #ff8c00cc', flexShrink: 0,
            }} />
            <span style={{ color: '#ff8c00', fontSize: 14, letterSpacing: '0.14em', fontWeight: 700, lineHeight: 1 }}>
              PULSED
            </span>
          </div>
          {/* Divider */}
          <span style={{ width: 1, height: 28, background: 'rgba(66,99,104,0.18)', flexShrink: 0, display: 'block' }} />
          {/* Porchfest logo */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/pf26-logo-navy.png"
            alt="Virginia Highland Porchfest 2026"
            style={{ height: 34, width: 'auto', opacity: 0.85, display: 'block' }}
          />
        </div>

        {/* ── Legend — top left, below header ── */}
        <div style={{
          position: 'absolute', top: 76, left: 14, zIndex: 1000,
          ...panelBase,
          borderRadius: 8,
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 14px',
          fontSize: 10, color: NAVY_TEXT,
          letterSpacing: '0.05em',
        }}>
          {/* Live — VHDA-palette gradient bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{
              width: 24, height: 6, borderRadius: 3, flexShrink: 0,
              background: 'linear-gradient(to right, #619cab, #c25534, #C17C2E, #619882, #426368)',
              display: 'inline-block',
            }} />
            live · by time
          </div>
          <span style={{ color: IVORY_BORDER, fontSize: 11 }}>|</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#888', display: 'inline-block', flexShrink: 0 }} />
            scheduled
          </div>
          <span style={{ color: IVORY_BORDER, fontSize: 11 }}>|</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#e03c3c', display: 'inline-block', flexShrink: 0 }} />
            cancelled
          </div>
        </div>

        {/* ── Set count — top right ── */}
        <div style={{
          position: 'absolute', top: 14, right: 14, zIndex: 1000,
          ...panelBase,
          padding: '10px 14px',
          fontSize: 11, color: NAVY_TEXT,
        }}>
          {(filterLive || filterGenre)
            ? `${filteredSets.length} of ${sets.length}`
            : livePinCount > 0
              ? <span style={{ color: '#ff8c00' }}>{livePinCount} live now</span>
              : `${sets.length} sets`
          }
        </div>

        {/* ── No-results message ── */}
        {sets.length > 0 && filteredSets.length === 0 && (
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1000,
            ...panelBase,
            padding: '14px 22px',
            fontSize: 12, color: NAVY_TEXT,
            textAlign: 'center',
            pointerEvents: 'none',
          }}>
            no sets match this filter
          </div>
        )}

        {/* ── Selected set panel — floats above filter bar ── */}
        {selected && (
          <div style={{
            position: 'absolute',
            bottom: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            background: 'rgba(233,232,228,0.97)',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
            border: `1px solid ${IVORY_BORDER}`,
            borderRadius: 14,
            padding: '20px 24px',
            minWidth: 290,
            maxWidth: 370,
            boxShadow: '0 6px 28px rgba(66,99,104,0.14)',
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{
                fontSize: 10,
                padding: '3px 10px',
                borderRadius: 20,
                background: effectiveStatus(selected) === 'cancelled' ? 'rgba(224,60,60,0.1)' :
                             effectiveStatus(selected) === 'scheduled' ? 'rgba(66,99,104,0.07)' :
                             `${pinColor(selected)}1a`,
                color: effectiveStatus(selected) === 'scheduled' ? NAVY_TEXT : pinColor(selected),
                letterSpacing: '0.05em',
              }}>
                {STATUS_LABEL[effectiveStatus(selected)]}
              </span>
              <button
                onClick={() => setSelected(null)}
                style={{ background: 'none', border: 'none', color: NAVY_TEXT, cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0 }}
              >
                ✕
              </button>
            </div>

            {/* Band name — Montserrat per organizer spec */}
            <div style={{ fontSize: 18, fontFamily: "'Montserrat', sans-serif", fontWeight: 600, color: '#1b2424', marginBottom: 4 }}>
              {selected.acts?.name}
            </div>
            <div style={{ fontSize: 12, fontFamily: "'Montserrat', sans-serif", color: NAVY_TEXT, marginBottom: 12 }}>
              {selected.acts?.genre}
            </div>

            <div style={{ fontSize: 11, color: NAVY_TEXT, opacity: 0.7, marginBottom: 10 }}>
              {selected.venues?.address}
            </div>

            <div style={{ fontSize: 12, color: NAVY_TEXT, marginBottom: selected.acts?.link ? 14 : 0 }}>
              {new Date(selected.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {' — '}
              {new Date(selected.ends_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {isNowPlaying(selected) && (
                <span style={{ color: pinColor(selected), marginLeft: 8 }}>● now</span>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              {selected.acts?.link && (
                <a
                  href={selected.acts.link.startsWith('http') ? selected.acts.link : `https://${selected.acts.link}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-block', fontSize: 11,
                    color: '#ff8c00',
                    border: '1px solid rgba(255,140,0,0.3)',
                    borderRadius: 20, padding: '5px 14px',
                    textDecoration: 'none', letterSpacing: '0.05em',
                  }}
                >
                  see more →
                </a>
              )}
              {selected.venues?.address && (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(selected.venues.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-block', fontSize: 11,
                    color: '#ff8c00',
                    background: 'rgba(255,140,0,0.07)',
                    border: '1px solid rgba(255,140,0,0.25)',
                    borderRadius: 20, padding: '5px 14px',
                    textDecoration: 'none', letterSpacing: '0.05em',
                  }}
                >
                  directions →
                </a>
              )}
            </div>
          </div>
        )}

        {/* ── Sponsor popup — floats above filter bar ── */}
        {selectedSponsor && (
          <div style={{
            position: 'absolute',
            bottom: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            background: 'rgba(233,232,228,0.97)',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
            border: '1px solid rgba(255,140,0,0.18)',
            borderRadius: 14,
            padding: '20px 24px',
            minWidth: 290,
            maxWidth: 370,
            boxShadow: '0 6px 28px rgba(255,140,0,0.10)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{
                fontSize: 10, padding: '3px 10px', borderRadius: 20,
                background: 'rgba(255,140,0,0.1)', color: '#ff8c00',
                letterSpacing: '0.08em', fontWeight: 600,
              }}>
                ★ pulsed sponsor
              </span>
              <button
                onClick={() => setSelectedSponsor(null)}
                style={{ background: 'none', border: 'none', color: NAVY_TEXT, cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0 }}
              >
                ✕
              </button>
            </div>

            <div style={{ fontSize: 18, fontFamily: "'Montserrat', sans-serif", fontWeight: 600, color: '#1b2424', marginBottom: 4 }}>
              {selectedSponsor.name}
            </div>
            <div style={{ fontSize: 11, fontFamily: "'Montserrat', sans-serif", color: NAVY_TEXT, marginBottom: 14 }}>
              {selectedSponsor.address}
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(selectedSponsor.name + ', Atlanta, GA')}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-block', fontSize: 11,
                  color: '#ff8c00',
                  background: 'rgba(255,140,0,0.07)',
                  border: '1px solid rgba(255,140,0,0.25)',
                  borderRadius: 20, padding: '5px 14px',
                  textDecoration: 'none', letterSpacing: '0.05em',
                }}
              >
                directions →
              </a>
              {selectedSponsor.url && (
                <a
                  href={selectedSponsor.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-block', fontSize: 11,
                    color: NAVY_TEXT,
                    border: `1px solid ${IVORY_BORDER}`,
                    borderRadius: 20, padding: '5px 14px',
                    textDecoration: 'none', letterSpacing: '0.05em',
                  }}
                >
                  website →
                </a>
              )}
            </div>
          </div>
        )}

        {/* ── Filter bar — pinned to bottom ── */}
        <div style={{
          position: 'absolute',
          bottom: 0, left: 0, right: 0,
          zIndex: 1000,
          background: 'rgba(233,232,228,0.96)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderTop: `1px solid ${IVORY_BORDER}`,
          padding: '10px 16px 14px',
          // fade hint at right edge
          WebkitMaskImage: 'linear-gradient(to right, black 88%, transparent 100%)',
          maskImage: 'linear-gradient(to right, black 88%, transparent 100%)',
        }}>
          <div className="filter-scroll" style={{
            display: 'flex',
            gap: 6,
            overflowX: 'auto',
            paddingRight: 32,
          }}>
            {/* Live now toggle */}
            <button
              onClick={() => setFilterLive(f => !f)}
              style={{
                ...pillBase,
                background: filterLive ? '#ff8c00' : 'rgba(255,255,255,0.7)',
                border: filterLive ? '1px solid #ff8c00' : `1px solid ${IVORY_BORDER}`,
                color: filterLive ? '#fff' : NAVY_TEXT,
              }}
            >
              ● live now
            </button>

            {/* Genre pills */}
            {genres.map(genre => (
              <button
                key={genre}
                onClick={() => setFilterGenre(g => g === genre ? null : genre)}
                style={{
                  ...pillBase,
                  background: filterGenre === genre ? 'rgba(255,140,0,0.1)' : 'rgba(255,255,255,0.7)',
                  border: filterGenre === genre ? '1px solid rgba(255,140,0,0.5)' : `1px solid ${IVORY_BORDER}`,
                  color: filterGenre === genre ? '#ff8c00' : NAVY_TEXT,
                }}
              >
                {genre}
              </button>
            ))}
          </div>
        </div>

        {/* ── Botanical overlay — bottom-left corner ── */}
        <svg
          viewBox="0 0 180 180"
          xmlns="http://www.w3.org/2000/svg"
          style={{
            position: 'fixed', bottom: 56, left: 0,
            width: 180, height: 180,
            pointerEvents: 'none', zIndex: 998, opacity: 0.32,
          }}
        >
          <g stroke="#426368" fill="none" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
            {/* Main stem */}
            <path d="M 15 178 C 30 155 50 125 65 85" />
            {/* Left fronds */}
            <path d="M 24 163 C 8 153 2 138 5 120" />
            <path d="M 36 145 C 18 133 12 116 16 97" />
            <path d="M 48 126 C 30 114 25 96 30 78" />
            <path d="M 58 107 C 44 95 40 78 45 61" />
            {/* Right fronds */}
            <path d="M 30 156 C 46 148 52 133 47 116" />
            <path d="M 42 138 C 58 128 63 113 57 96" />
            <path d="M 54 118 C 68 108 72 92 65 76" />
            <path d="M 63 98 C 76 88 78 73 71 57" />
            {/* Small leaf tips — left side */}
            <path d="M 5 120 C 0 110 -2 100 3 93" />
            <path d="M 16 97 C 10 87 9 76 15 70" />
            <path d="M 30 78 C 24 68 23 58 30 52" />
            {/* Small leaf tips — right side */}
            <path d="M 47 116 C 52 106 55 95 50 88" />
            <path d="M 57 96 C 62 86 64 75 59 68" />
            <path d="M 65 76 C 70 66 72 55 67 48" />
          </g>
        </svg>

        {/* ── Botanical overlay — bottom-right corner ── */}
        <svg
          viewBox="0 0 180 180"
          xmlns="http://www.w3.org/2000/svg"
          style={{
            position: 'fixed', bottom: 56, right: 0,
            width: 180, height: 180,
            pointerEvents: 'none', zIndex: 998, opacity: 0.32,
            transform: 'scaleX(-1)',
          }}
        >
          <g stroke="#619882" fill="none" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
            {/* Main stem */}
            <path d="M 15 178 C 30 155 50 125 65 85" />
            {/* Left fronds */}
            <path d="M 24 163 C 8 153 2 138 5 120" />
            <path d="M 36 145 C 18 133 12 116 16 97" />
            <path d="M 48 126 C 30 114 25 96 30 78" />
            <path d="M 58 107 C 44 95 40 78 45 61" />
            {/* Right fronds */}
            <path d="M 30 156 C 46 148 52 133 47 116" />
            <path d="M 42 138 C 58 128 63 113 57 96" />
            <path d="M 54 118 C 68 108 72 92 65 76" />
            <path d="M 63 98 C 76 88 78 73 71 57" />
            {/* Small leaf tips — left side */}
            <path d="M 5 120 C 0 110 -2 100 3 93" />
            <path d="M 16 97 C 10 87 9 76 15 70" />
            <path d="M 30 78 C 24 68 23 58 30 52" />
            {/* Small leaf tips — right side */}
            <path d="M 47 116 C 52 106 55 95 50 88" />
            <path d="M 57 96 C 62 86 64 75 59 68" />
            <path d="M 65 76 C 70 66 72 55 67 48" />
          </g>
        </svg>

      </div>
    </>
  )
}
