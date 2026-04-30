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

// Human-readable EDT labels for each UTC hour slot
const SLOT_LABELS: Record<number, string> = {
  14: '10 AM', 15: '11 AM', 16: '12 PM', 17: '1 PM',
  18: '2 PM', 19: '3 PM', 20: '4 PM', 21: '5 PM', 23: '7 PM',
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

// VHDA 9-color stripe gradient — hard stops, 30px per slot, 270px total
const VHDA_STRIPE_H = [
  'repeating-linear-gradient(90deg,',
  '#81817f   0px  30px,',
  '#619cab  30px  60px,',
  '#c25534  60px  90px,',
  '#619882  90px 120px,',
  '#7A525B 120px 150px,',
  '#C17C2E 150px 180px,',
  '#426368 180px 210px,',
  '#787342 210px 240px,',
  '#1b2424 240px 270px)',
].join(' ')

// Same palette, vertical — for the side ribbons
const VHDA_STRIPE_V = [
  'repeating-linear-gradient(180deg,',
  '#81817f   0px  30px,',
  '#619cab  30px  60px,',
  '#c25534  60px  90px,',
  '#619882  90px 120px,',
  '#7A525B 120px 150px,',
  '#C17C2E 150px 180px,',
  '#426368 180px 210px,',
  '#787342 210px 240px,',
  '#1b2424 240px 270px)',
].join(' ')

// VHDA design tokens
const IVORY = 'rgba(233,232,228,0.94)'
const IVORY_BORDER = 'rgba(66,99,104,0.14)'
const IVORY_SHADOW = '0 2px 16px rgba(66,99,104,0.22), 0 1px 4px rgba(66,99,104,0.12)'
const NAVY_TEXT = 'rgba(66,99,104,0.55)'

export default function MapPage() {
  const mapRef = useRef<HTMLDivElement>(null)
  const leafletMap = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const locationLatLngRef = useRef<any>(null)   // user's GPS location
  const hasFitRef = useRef(false)               // has the map auto-fitted to pins yet?
  const [sets, setSets] = useState<SetRow[]>([])
  const [sponsors, setSponsors] = useState<Sponsor[]>([])
  const [selected, setSelected] = useState<SetRow | null>(null)
  const [selectedSponsor, setSelectedSponsor] = useState<Sponsor | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [filterLive, setFilterLive] = useState(false)
  const [filterGenre, setFilterGenre] = useState<string | null>(null)
  const [filterTime, setFilterTime] = useState<number | null>(null)

  // Unique sorted genres from loaded sets
  const genres = Array.from(new Set(sets.map(s => s.acts?.genre).filter(Boolean) as string[])).sort()

  // Sets visible on map after filters applied
  const filteredSets = sets.filter(set => {
    if (filterLive && !isNowPlaying(set)) return false
    if (filterGenre && set.acts?.genre !== filterGenre) return false
    if (filterTime !== null && new Date(set.starts_at).getUTCHours() !== filterTime) return false
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
  }, [filterLive, filterGenre, filterTime])

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
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a> © <a href="https://carto.com/">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map)

      // Strip the "Leaflet" branding prefix — OSM/CARTO attribution stays (required by their terms)
      map.attributionControl.setPrefix('')

      // Zoom controls intentionally omitted — custom themed buttons added in JSX
      // GPS dot
      let locationMarker: any = null
      let accuracyCircle: any = null

      map.on('locationfound', (e: any) => {
        locationLatLngRef.current = e.latlng
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

  // Auto-fit map to venue bounds on first data load
  useEffect(() => {
    if (!loaded || !leafletMap.current || hasFitRef.current) return
    if (sets.length === 0) return

    import('leaflet').then(L => {
      const coords = sets
        .filter(s => s.venues?.lat && s.venues?.lng)
        .map(s => [s.venues!.lat!, s.venues!.lng!] as [number, number])
      if (coords.length === 0) return
      const bounds = L.latLngBounds(coords)
      leafletMap.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 17 })
      hasFitRef.current = true
    })
  }, [sets, loaded])

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
        const isScheduled = effectiveStatus(topSet) === 'scheduled'

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
                background: ${isScheduled ? 'rgba(136,136,136,0.20)' : color};
                border: 2px solid ${color};
                box-shadow: ${(isCancelled || isScheduled) ? 'none' : `0 0 10px ${color}88, 0 0 20px ${color}44`};
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
        @keyframes popupSlideUp {
          0%   { transform: translateX(-50%) translateY(16px); opacity: 0; }
          100% { transform: translateX(-50%) translateY(0);    opacity: 1; }
        }
        @keyframes liveBadgePulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,140,0,0.55); }
          50%       { box-shadow: 0 0 0 5px rgba(255,140,0,0);  }
        }
        @keyframes pulseDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.55; transform: scale(1.45); }
        }
        /* Raise Leaflet attribution above 2-row filter bar */
        .leaflet-bottom.leaflet-right { bottom: 100px !important; right: 0 !important; }
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

        {/* ── Safe-area top cap — covers Dynamic Island zone with dark bg ── */}
        {/* height is 0 on desktop (env() returns 0 without viewport-fit=cover) */}
        {/* On iPhone it fills the exact safe-area inset, creating breathing room */}
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0,
          height: 'env(safe-area-inset-top, 0px)',
          background: 'rgba(10,10,15,0.82)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          zIndex: 2000,
          pointerEvents: 'none',
        }} />

        {/* ── Header — centered top ── */}
        {/* position:fixed so env(safe-area-inset-top) resolves reliably vs viewport on all iOS devices */}
        <div style={{
          position: 'fixed',
          top: 'calc(env(safe-area-inset-top, 0px) + 14px)',
          left: '50%', transform: 'translateX(-50%)',
          zIndex: 1000,
          borderRadius: 13, padding: 3,
          background: VHDA_STRIPE_H, backgroundSize: '270px 100%',
          boxShadow: IVORY_SHADOW,
        }}>
          <div style={{
            background: IVORY, backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
            borderRadius: 10,
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '14px 20px',
          }}>
            {/* PULSED brand — links to pulsedapp.live */}
            <a
              href="https://pulsedapp.live"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', flexShrink: 0 }}
            >
              <span style={{
                width: 9, height: 9, borderRadius: '50%',
                background: '#ff8c00', display: 'inline-block',
                boxShadow: '0 0 10px #ff8c00cc', flexShrink: 0,
              }} />
              <span style={{ color: '#ff8c00', fontSize: 15, letterSpacing: '0.14em', fontWeight: 700, lineHeight: 1 }}>
                PULSED
              </span>
            </a>
            {/* Divider */}
            <span style={{ width: 1, height: 50, background: 'rgba(66,99,104,0.18)', flexShrink: 0, display: 'block' }} />
            {/* Porchfest logo — links to VHDA site. flexShrink:0 + width:auto preserves native aspect ratio. */}
            <a
              href="https://vhda.org"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'block', lineHeight: 0, flexShrink: 0 }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/pf26-logo-navy.png"
                alt="Virginia Highland Porchfest 2026"
                style={{ height: 50, width: 'auto', opacity: 0.9, display: 'block' }}
              />
            </a>
          </div>
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
            bottom: 'calc(204px + env(safe-area-inset-bottom, 0px))',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            borderRadius: 16, padding: 2,
            background: VHDA_STRIPE_H, backgroundSize: '270px 100%',
            boxShadow: '0 6px 28px rgba(66,99,104,0.14)',
            animation: 'popupSlideUp 0.22s cubic-bezier(0.22,1,0.36,1) both',
          }}>
          <div style={{
            background: 'rgba(233,232,228,0.97)',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
            borderRadius: 14,
            padding: '20px 24px',
            minWidth: 290,
            maxWidth: 370,
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              {effectiveStatus(selected) === 'live' ? (
                <span style={{
                  fontSize: 10,
                  padding: '3px 10px 3px 8px',
                  borderRadius: 20,
                  background: `${pinColor(selected)}22`,
                  color: pinColor(selected),
                  letterSpacing: '0.06em',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  animation: 'liveBadgePulse 1.8s ease-in-out infinite',
                }}>
                  <span style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: pinColor(selected),
                    display: 'inline-block',
                    flexShrink: 0,
                  }} />
                  live now
                </span>
              ) : (
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
              )}
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
          </div>
        )}

        {/* ── Sponsor popup — floats above filter bar ── */}
        {selectedSponsor && (
          <div style={{
            position: 'absolute',
            bottom: 'calc(204px + env(safe-area-inset-bottom, 0px))',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            borderRadius: 16, padding: 2,
            background: VHDA_STRIPE_H, backgroundSize: '270px 100%',
            boxShadow: '0 6px 28px rgba(66,99,104,0.14)',
          }}>
          <div style={{
            background: 'rgba(233,232,228,0.97)',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
            borderRadius: 14,
            padding: '20px 24px',
            minWidth: 290,
            maxWidth: 370,
            fontFamily: "'JetBrains Mono', monospace",
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
          </div>
        )}

        {/* ── "Find a Pulse" pill + live count ── */}
        <div style={{
          position: 'absolute',
          bottom: 'calc(148px + env(safe-area-inset-bottom, 0px))',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1001,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
        }}>
          {/* Stripe border wrapper — animates only when filter is active */}
          <div style={{
            borderRadius: 26,
            padding: 2,
            background: VHDA_STRIPE_H,
            backgroundSize: '270px 100%',
            animation: filterLive ? 'ribbonScroll 3s linear infinite' : 'none',
            boxShadow: filterLive
              ? '0 4px 18px rgba(0,0,0,0.35)'
              : '0 3px 14px rgba(255,140,0,0.22), 0 1px 4px rgba(0,0,0,0.10)',
          }}>
            <button
              onClick={() => setFilterLive(f => !f)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: filterLive
                  ? 'rgba(20,20,20,0.88)'
                  : 'rgba(255,255,255,0.95)',
                border: 'none',
                color: filterLive ? '#fff' : '#1b2424',
                borderRadius: 24,
                padding: '10px 22px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 12,
                fontWeight: filterLive ? 700 : 500,
                letterSpacing: '0.06em',
                whiteSpace: 'nowrap',
                backdropFilter: 'blur(14px)',
                WebkitBackdropFilter: 'blur(14px)',
                transition: 'background 0.18s ease, color 0.18s ease',
              }}
            >
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: filterLive ? '#ffd060' : '#ff8c00',
                display: 'inline-block', flexShrink: 0,
                animation: 'pulseDot 1.6s ease-in-out infinite',
              }} />
              find a pulse
            </button>
          </div>
          {/* Live set count below the button */}
          <span style={{
            fontSize: 10,
            color: livePinCount > 0 ? '#ff8c00' : NAVY_TEXT,
            letterSpacing: '0.08em',
            fontWeight: livePinCount > 0 ? 600 : 400,
            whiteSpace: 'nowrap',
          }}>
            {(filterLive || filterGenre || filterTime !== null)
              ? `${filteredSets.length} of ${sets.length} sets`
              : livePinCount > 0
                ? `${livePinCount} live · ${sets.length} sets`
                : `${sets.length} sets`
            }
          </span>
        </div>

        {/* ── VHDA side ribbons — left and right edges, full height, z998 so filter bar + header sit on top ── */}
        <div style={{
          position: 'fixed', top: 0, bottom: 0, left: 0,
          width: 6,
          background: VHDA_STRIPE_V, backgroundSize: '100% 270px',
          zIndex: 998, pointerEvents: 'none',
        }} />
        <div style={{
          position: 'fixed', top: 0, bottom: 0, right: 0,
          width: 6,
          background: VHDA_STRIPE_V, backgroundSize: '100% 270px',
          zIndex: 998, pointerEvents: 'none',
        }} />

        {/* ── Transparent-to-orange gradient halo — raises the visual start of the filter bar ── */}
        <div style={{
          position: 'absolute',
          bottom: 'calc(92px + env(safe-area-inset-bottom, 0px))',
          left: 0, right: 0,
          height: 60,
          background: 'linear-gradient(to bottom, transparent 0%, rgba(255,140,0,0.88) 100%)',
          zIndex: 999,
          pointerEvents: 'none',
        }} />

        {/* ── Filter bar — Genre + Time rows, pinned to bottom ── */}
        <div style={{
          position: 'absolute',
          bottom: 0, left: 0, right: 0,
          zIndex: 1000,
          background: 'linear-gradient(to right, #ff8c00 0%, #ffd060 100%)',
          paddingTop: 14,
          paddingLeft: 14,
          paddingRight: 14,
          /* Push content above iPhone home indicator */
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 14px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          overflow: 'hidden',
        }}>

          {/* ── Row 1: Genre ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, minHeight: 34 }}>
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'rgba(0,0,0,0.32)',
              flexShrink: 0, width: 48, paddingLeft: 2,
            }}>Genre</span>
            <div style={{ width: 1, height: 18, background: 'rgba(0,0,0,0.14)', flexShrink: 0, marginRight: 8 }} />
            {/* scroll area */}
            <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
              <div className="filter-scroll" style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingRight: 28 }}>
                {genres.map(genre => (
                  <button
                    key={genre}
                    onClick={() => setFilterGenre(g => g === genre ? null : genre)}
                    style={{
                      flexShrink: 0,
                      fontSize: 11,
                      padding: '6px 13px',
                      borderRadius: 18,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      letterSpacing: '0.04em',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s ease',
                      minHeight: 34,
                      display: 'inline-flex',
                      alignItems: 'center',
                      background: filterGenre === genre ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.82)',
                      border: filterGenre === genre ? '1px solid rgba(0,0,0,0.18)' : '1px solid rgba(255,255,255,0.5)',
                      color: filterGenre === genre ? '#fff' : '#1b2424',
                      fontWeight: filterGenre === genre ? 600 : 400,
                    }}
                  >
                    {genre}
                  </button>
                ))}
              </div>
              {/* right-edge fade */}
              <div style={{
                position: 'absolute', top: 0, right: 0, bottom: 0, width: 36,
                background: 'linear-gradient(to right, transparent, #ffd060)',
                pointerEvents: 'none',
              }} />
            </div>
          </div>

          {/* ── Row: Time ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, minHeight: 34 }}>
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'rgba(0,0,0,0.32)',
              flexShrink: 0, width: 48, paddingLeft: 2,
            }}>Time</span>
            <div style={{ width: 1, height: 18, background: 'rgba(0,0,0,0.14)', flexShrink: 0, marginRight: 8 }} />
            {/* scroll area */}
            <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
              <div className="filter-scroll" style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingRight: 28 }}>
                {(Object.entries(SLOT_LABELS) as [string, string][]).map(([utcHour, label]) => {
                  const hour = Number(utcHour)
                  const slotCol = SLOT_COLORS[hour]
                  const isActive = filterTime === hour
                  return (
                    <button
                      key={hour}
                      onClick={() => setFilterTime(t => t === hour ? null : hour)}
                      style={{
                        flexShrink: 0,
                        fontSize: 11,
                        padding: '6px 13px',
                        borderRadius: 18,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        letterSpacing: '0.04em',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.15s ease',
                        minHeight: 34,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        background: isActive ? slotCol : 'rgba(255,255,255,0.82)',
                        border: isActive ? `1px solid ${slotCol}` : '1px solid rgba(255,255,255,0.5)',
                        color: isActive ? '#fff' : '#1b2424',
                        fontWeight: isActive ? 600 : 400,
                      }}
                    >
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: isActive ? 'rgba(255,255,255,0.75)' : slotCol,
                        display: 'inline-block', flexShrink: 0,
                      }} />
                      {label}
                    </button>
                  )
                })}
              </div>
              {/* right-edge fade */}
              <div style={{
                position: 'absolute', top: 0, right: 0, bottom: 0, width: 36,
                background: 'linear-gradient(to right, transparent, #ffd060)',
                pointerEvents: 'none',
              }} />
            </div>
          </div>

        </div>

        {/* ── Map controls cluster — right side, above filter bar ── */}
        <div style={{
          position: 'absolute',
          right: 14,
          bottom: 'calc(200px + env(safe-area-inset-bottom, 0px))',
          zIndex: 1001,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
        }}>
          {/* Zoom + */}
          <button
            onClick={() => leafletMap.current?.zoomIn()}
            title="Zoom in"
            style={{
              width: 34, height: 34,
              borderRadius: '50%',
              background: IVORY,
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              border: `1px solid ${IVORY_BORDER}`,
              boxShadow: IVORY_SHADOW,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              color: '#426368',
              fontSize: 20,
              fontWeight: 300,
              lineHeight: 1,
              fontFamily: 'inherit',
            }}
          >+</button>

          {/* Zoom − */}
          <button
            onClick={() => leafletMap.current?.zoomOut()}
            title="Zoom out"
            style={{
              width: 34, height: 34,
              borderRadius: '50%',
              background: IVORY,
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              border: `1px solid ${IVORY_BORDER}`,
              boxShadow: IVORY_SHADOW,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              color: '#426368',
              fontSize: 20,
              fontWeight: 300,
              lineHeight: 1,
              fontFamily: 'inherit',
            }}
          >−</button>

          {/* Divider */}
          <div style={{ width: 20, height: 1, background: IVORY_BORDER, margin: '2px 0' }} />

          {/* Center-on-me */}
          <button
            onClick={() => {
              if (!locationLatLngRef.current || !leafletMap.current) return
              leafletMap.current.setView(locationLatLngRef.current, 17, { animate: true })
            }}
            title="Center on my location"
            style={{
              width: 34, height: 34,
              borderRadius: '50%',
              background: IVORY,
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              border: `1px solid ${IVORY_BORDER}`,
              boxShadow: IVORY_SHADOW,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="8" cy="8" r="3" fill="#619882" />
              <circle cx="8" cy="8" r="5.5" stroke="#426368" strokeWidth="1.2" fill="none" />
              <line x1="8" y1="1" x2="8" y2="3.5" stroke="#426368" strokeWidth="1.2" strokeLinecap="round" />
              <line x1="8" y1="12.5" x2="8" y2="15" stroke="#426368" strokeWidth="1.2" strokeLinecap="round" />
              <line x1="1" y1="8" x2="3.5" y2="8" stroke="#426368" strokeWidth="1.2" strokeLinecap="round" />
              <line x1="12.5" y1="8" x2="15" y2="8" stroke="#426368" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* ── Botanical overlays — removed pending new inspiration ── */}

      </div>
    </>
  )
}
