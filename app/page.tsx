'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase, type SetRow } from '@/lib/supabase'

const STATUS_COLORS: Record<string, string> = {
  live: '#ff8c00',
  running_late: '#ffb830',
  cancelled: '#aaa',
  scheduled: '#ff8c00',
}

const STATUS_LABEL: Record<string, string> = {
  live: 'live now',
  running_late: 'running late',
  cancelled: 'cancelled',
  scheduled: 'scheduled',
}

export default function MapPage() {
  const mapRef = useRef<HTMLDivElement>(null)
  const leafletMap = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const [sets, setSets] = useState<SetRow[]>([])
  const [selected, setSelected] = useState<SetRow | null>(null)
  const [loaded, setLoaded] = useState(false)

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

  // Init map once
  useEffect(() => {
    if (leafletMap.current) return

    // Dynamic import so Leaflet doesn't run on server
    import('leaflet').then(L => {
      if (!mapRef.current || leafletMap.current) return

      // Fix default icon paths in Next.js
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      const map = L.map(mapRef.current!, {
        center: [33.7838, -84.3647], // Virginia Highland, Atlanta
        zoom: 16,
        zoomControl: false,
      })

      // Light tile layer (CartoDB Positron)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap © CARTO',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map)

      // Zoom control bottom right
      L.control.zoom({ position: 'bottomright' }).addTo(map)

      // GPS dot — track user location
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

  // Load sets on mount + poll every 30s + real-time subscription
  useEffect(() => {
    loadSets()
    const interval = setInterval(loadSets, 30000)

    const channel = supabase
      .channel('sets-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sets' }, () => {
        loadSets()
      })
      .subscribe()

    return () => {
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [])

  // Update markers when sets change
  useEffect(() => {
    if (!loaded || !leafletMap.current) return

    import('leaflet').then(L => {
      // Clear existing markers
      markersRef.current.forEach(m => m.remove())
      markersRef.current = []

      // Group sets by venue
      const byVenue = new Map<string, SetRow[]>()
      sets.forEach(set => {
        if (!set.venues) return
        const key = set.venue_id
        if (!byVenue.has(key)) byVenue.set(key, [])
        byVenue.get(key)!.push(set)
      })

      byVenue.forEach((venueSets, venueId) => {
        const venue = venueSets[0].venues!
        if (!venue.lat || !venue.lng) return

        // Pick the most interesting status for the pin color
        const statusPriority = ['live', 'running_late', 'scheduled', 'cancelled']
        const topSet = venueSets.sort((a, b) =>
          statusPriority.indexOf(a.status) - statusPriority.indexOf(b.status)
        )[0]

        const color = STATUS_COLORS[topSet.status] || '#ff8c00'
        const isCancelled = topSet.status === 'cancelled'

        const icon = L.divIcon({
          className: '',
          html: `
            <div style="
              width: 14px;
              height: 14px;
              border-radius: 50%;
              background: ${color};
              border: 2px solid ${isCancelled ? '#333' : color};
              box-shadow: ${isCancelled ? 'none' : `0 0 10px ${color}88, 0 0 20px ${color}44`};
              opacity: ${isCancelled ? '0.4' : '1'};
              cursor: pointer;
            "></div>
          `,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        })

        const marker = L.marker([venue.lat, venue.lng], { icon })
          .addTo(leafletMap.current)
          .on('click', () => {
            setSelected(venueSets[0])
          })

        markersRef.current.push(marker)
      })
    })
  }, [sets, loaded])

  // "now playing" check — is this set currently active?
  function isNowPlaying(set: SetRow) {
    const now = Date.now()
    return now >= new Date(set.starts_at).getTime() && now <= new Date(set.ends_at).getTime()
  }

  return (
    <>
      {/* Leaflet CSS */}
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      />

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
          {sets.filter(s => s.status === 'live').length > 0
            ? <span style={{ color: '#ff8c00' }}>{sets.filter(s => s.status === 'live').length} live now</span>
            : `${sets.length} sets`
          }
        </div>

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
            {/* Status badge */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{
                fontSize: 10,
                padding: '3px 10px',
                borderRadius: 20,
                background: selected.status === 'live' ? 'rgba(255,140,0,0.12)' :
                             selected.status === 'running_late' ? 'rgba(255,184,48,0.12)' :
                             selected.status === 'cancelled' ? 'rgba(200,50,50,0.08)' :
                             'rgba(0,0,0,0.05)',
                color: STATUS_COLORS[selected.status],
                letterSpacing: '0.05em',
              }}>
                {STATUS_LABEL[selected.status]}
              </span>
              <button
                onClick={() => setSelected(null)}
                style={{ background: 'none', border: 'none', color: 'rgba(0,0,0,0.22)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0 }}
              >
                ✕
              </button>
            </div>

            {/* Band info */}
            <div style={{ fontSize: 18, color: 'rgba(0,0,0,0.85)', marginBottom: 4 }}>
              {selected.acts?.name}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.35)', marginBottom: 12 }}>
              {selected.acts?.genre}
            </div>

            {/* Address */}
            <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.3)', marginBottom: 10 }}>
              {selected.venues?.address}
            </div>

            {/* Times */}
            <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.4)', marginBottom: selected.acts?.link ? 14 : 0 }}>
              {new Date(selected.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {' — '}
              {new Date(selected.ends_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {isNowPlaying(selected) && (
                <span style={{ color: '#ff8c00', marginLeft: 8 }}>● now</span>
              )}
            </div>

            {/* Link */}
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
          </div>
        )}

        {/* Legend */}
        <div style={{
          position: 'absolute',
          bottom: 32,
          right: 20,
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
          {[
            { color: '#ff8c00', label: 'live' },
            { color: '#ffb830', label: 'running late' },
            { color: '#aaa', label: 'cancelled' },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, display: 'inline-block' }} />
              {label}
            </div>
          ))}
        </div>

      </div>
    </>
  )
}
