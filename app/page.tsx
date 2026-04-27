'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase, type SetRow, type Sponsor } from '@/lib/supabase'

const STATUS_COLORS: Record<string, string> = {
  cancelled: '#e03c3c',
  scheduled: '#888',
}

// One color per UTC hour — maps to a warm sunrise→sunset gradient across the day.
// Bands in the same time slot share the same glow color when live.
const SLOT_COLORS: Record<number, string> = {
  14: '#ffd060', // 10 AM EDT — bright morning yellow
  15: '#ffbe30', // 11 AM EDT — golden amber
  16: '#ffb030', // 12 PM EDT — warm amber
  17: '#ff8c00', // 1 PM EDT  — brand orange (peak)
  18: '#ff7210', // 2 PM EDT  — deeper orange
  19: '#ff6b10', // 3 PM EDT  — deep orange
  20: '#e85500', // 4 PM EDT  — burnt orange
  21: '#cc4400', // 5 PM EDT  — late afternoon rust
  23: '#a83300', // 7 PM EDT  — evening deep red-orange
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
          color: '#4a90e2',
          fillColor: '#4a90e2',
          fillOpacity: 0.08,
          weight: 1,
        }).addTo(map)

        const dot = L.divIcon({
          className: '',
          html: `<div style="
            width: 14px;
            height: 14px;
            border-radius: 50%;
            background: #4a90e2;
            border: 2.5px solid #fff;
            box-shadow: 0 0 0 2px #4a90e2, 0 2px 6px rgba(0,0,0,0.25);
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
                background: rgba(255,255,255,0.92);
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
    fontSize: 11,
    padding: '6px 14px',
    borderRadius: 20,
    cursor: 'pointer',
    fontFamily: 'inherit',
    letterSpacing: '0.05em',
    whiteSpace: 'nowrap',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    backdropFilter: 'blur(12px)',
    transition: 'all 0.15s ease',
  }

  return (
    <>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <style>{`
        @keyframes liveRipple {
          0%   { transform: scale(1);   opacity: 0.7; }
          100% { transform: scale(3.2); opacity: 0;   }
        }
      `}</style>

      <div style={{ position: 'relative', width: '100vw', height: '100vh', background: '#f0efeb', fontFamily: "'JetBrains Mono', monospace" }}>

        {/* Map */}
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

        {/* Header */}
        <div style={{
          position: 'absolute',
          top: 20,
          left: 20,
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(12px)',
          padding: '10px 16px',
          borderRadius: 8,
          border: '1px solid rgba(0,0,0,0.07)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
        }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ff8c00', display: 'inline-block', boxShadow: '0 0 8px #ff8c00aa' }} />
          <span style={{ color: '#ff8c00', fontSize: 13, letterSpacing: '0.1em', fontWeight: 600 }}>PULSED</span>
          <span style={{ color: 'rgba(0,0,0,0.28)', fontSize: 11, marginLeft: 4 }}>va-hi porchfest 2026</span>
        </div>

        {/* Set count */}
        <div style={{
          position: 'absolute',
          top: 20,
          right: 20,
          zIndex: 1000,
          background: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(12px)',
          padding: '10px 14px',
          borderRadius: 8,
          border: '1px solid rgba(0,0,0,0.07)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
          fontSize: 11,
          color: 'rgba(0,0,0,0.35)',
        }}>
          {(filterLive || filterGenre)
            ? `${filteredSets.length} of ${sets.length}`
            : sets.filter(s => effectiveStatus(s) === 'live').length > 0
              ? <span style={{ color: '#ff8c00' }}>{sets.filter(s => effectiveStatus(s) === 'live').length} live now</span>
              : `${sets.length} sets`
          }
        </div>

        {/* Filter bar */}
        <div style={{
          position: 'absolute',
          top: 72,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          maxWidth: 'calc(100vw - 40px)',
          // fade hint at right edge
          WebkitMaskImage: 'linear-gradient(to right, black 85%, transparent 100%)',
          maskImage: 'linear-gradient(to right, black 85%, transparent 100%)',
        }}>
        <div className="filter-scroll" style={{
          display: 'flex',
          gap: 6,
          overflowX: 'auto',
          paddingBottom: 2,
          paddingRight: 24,
          msOverflowStyle: 'none',
          scrollbarWidth: 'none',
        }}>
          {/* Live now toggle */}
          <button
            onClick={() => setFilterLive(f => !f)}
            style={{
              ...pillBase,
              background: filterLive ? '#ff8c00' : 'rgba(255,255,255,0.88)',
              border: filterLive ? '1px solid #ff8c00' : '1px solid rgba(0,0,0,0.1)',
              color: filterLive ? '#fff' : 'rgba(0,0,0,0.5)',
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
                background: filterGenre === genre ? 'rgba(255,140,0,0.1)' : 'rgba(255,255,255,0.88)',
                border: filterGenre === genre ? '1px solid #ff8c00' : '1px solid rgba(0,0,0,0.1)',
                color: filterGenre === genre ? '#ff8c00' : 'rgba(0,0,0,0.5)',
              }}
            >
              {genre}
            </button>
          ))}
        </div>
        </div>

        {/* No results message */}
        {sets.length > 0 && filteredSets.length === 0 && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1000,
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(12px)',
            padding: '14px 22px',
            borderRadius: 10,
            border: '1px solid rgba(0,0,0,0.07)',
            boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
            fontSize: 12,
            color: 'rgba(0,0,0,0.4)',
            textAlign: 'center',
            pointerEvents: 'none',
          }}>
            no sets match this filter
          </div>
        )}

        {/* Selected set panel */}
        {selected && (
          <div style={{
            position: 'absolute',
            bottom: 32,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            background: 'rgba(255,255,255,0.96)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(0,0,0,0.07)',
            borderRadius: 12,
            padding: '20px 24px',
            minWidth: 280,
            maxWidth: 360,
            boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{
                fontSize: 10,
                padding: '3px 10px',
                borderRadius: 20,
                background: effectiveStatus(selected) === 'cancelled' ? 'rgba(224,60,60,0.1)' :
                             effectiveStatus(selected) === 'scheduled' ? 'rgba(0,0,0,0.05)' :
                             `${pinColor(selected)}1a`,
                color: pinColor(selected),
                letterSpacing: '0.05em',
              }}>
                {STATUS_LABEL[effectiveStatus(selected)]}
              </span>
              <button
                onClick={() => setSelected(null)}
                style={{ background: 'none', border: 'none', color: 'rgba(0,0,0,0.22)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0 }}
              >
                ✕
              </button>
            </div>

            <div style={{ fontSize: 18, color: 'rgba(0,0,0,0.85)', marginBottom: 4 }}>
              {selected.acts?.name}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.35)', marginBottom: 12 }}>
              {selected.acts?.genre}
            </div>

            <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.3)', marginBottom: 10 }}>
              {selected.venues?.address}
            </div>

            <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.4)', marginBottom: selected.acts?.link ? 14 : 0 }}>
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
                    display: 'inline-block',
                    fontSize: 11,
                    color: '#ff8c00',
                    border: '1px solid rgba(255,140,0,0.3)',
                    borderRadius: 20,
                    padding: '5px 14px',
                    textDecoration: 'none',
                    letterSpacing: '0.05em',
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
                    display: 'inline-block',
                    fontSize: 11,
                    color: '#ff8c00',
                    background: 'rgba(255,140,0,0.08)',
                    border: '1px solid rgba(255,140,0,0.3)',
                    borderRadius: 20,
                    padding: '5px 14px',
                    textDecoration: 'none',
                    letterSpacing: '0.05em',
                  }}
                >
                  directions →
                </a>
              )}
            </div>
          </div>
        )}

        {/* Sponsor popup */}
        {selectedSponsor && (
          <div style={{
            position: 'absolute',
            bottom: 32,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            background: 'rgba(255,255,255,0.96)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,140,0,0.2)',
            borderRadius: 12,
            padding: '20px 24px',
            minWidth: 280,
            maxWidth: 360,
            boxShadow: '0 4px 24px rgba(255,140,0,0.12)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{
                fontSize: 10,
                padding: '3px 10px',
                borderRadius: 20,
                background: 'rgba(255,140,0,0.1)',
                color: '#ff8c00',
                letterSpacing: '0.08em',
                fontWeight: 600,
              }}>
                ★ pulsed sponsor
              </span>
              <button
                onClick={() => setSelectedSponsor(null)}
                style={{ background: 'none', border: 'none', color: 'rgba(0,0,0,0.22)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0 }}
              >
                ✕
              </button>
            </div>

            <div style={{ fontSize: 18, color: 'rgba(0,0,0,0.85)', marginBottom: 4 }}>
              {selectedSponsor.name}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.3)', marginBottom: 14 }}>
              {selectedSponsor.address}
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(selectedSponsor.name + ', Atlanta, GA')}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-block',
                  fontSize: 11,
                  color: '#ff8c00',
                  background: 'rgba(255,140,0,0.08)',
                  border: '1px solid rgba(255,140,0,0.3)',
                  borderRadius: 20,
                  padding: '5px 14px',
                  textDecoration: 'none',
                  letterSpacing: '0.05em',
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
                    display: 'inline-block',
                    fontSize: 11,
                    color: 'rgba(0,0,0,0.4)',
                    border: '1px solid rgba(0,0,0,0.1)',
                    borderRadius: 20,
                    padding: '5px 14px',
                    textDecoration: 'none',
                    letterSpacing: '0.05em',
                  }}
                >
                  website →
                </a>
              )}
            </div>
          </div>
        )}

        {/* Legend */}
        <div style={{
          position: 'absolute',
          bottom: selected || selectedSponsor ? 280 : 32,
          right: 20,
          transition: 'bottom 0.2s ease',
          zIndex: 1000,
          background: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(12px)',
          padding: '12px 14px',
          borderRadius: 8,
          border: '1px solid rgba(0,0,0,0.07)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
          fontSize: 10,
          color: 'rgba(0,0,0,0.35)',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}>
          {/* Live — gradient pill to show "color = time slot" */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{
              width: 24,
              height: 7,
              borderRadius: 4,
              background: 'linear-gradient(to right, #ffd060, #ff8c00, #a83300)',
              display: 'inline-block',
              flexShrink: 0,
            }} />
            live · by time
          </div>
          {[
            { color: '#888', label: 'scheduled' },
            { color: '#e03c3c', label: 'cancelled' },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
              {label}
            </div>
          ))}
        </div>

      </div>
    </>
  )
}
