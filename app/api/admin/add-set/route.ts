import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address + ', Atlanta, GA')}`,
    { headers: { 'User-Agent': 'Pulsed/1.0' } }
  )
  const data = await res.json()
  if (data && data[0]) {
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  }
  return null
}

export async function POST(req: NextRequest) {
  // Auth check
  const token = req.headers.get('x-admin-token')
  if (token !== process.env.ADMIN_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { bandName, genre, address, startTime, endTime } = await req.json()

  if (!bandName || !genre || !address || !startTime || !endTime) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Geocode
  const coords = await geocode(address)
  if (!coords) {
    return NextResponse.json(
      { error: 'Could not find that address. Try adding the street name + "Atlanta GA".' },
      { status: 400 }
    )
  }

  // Upsert venue
  const { data: venueData, error: venueError } = await supabase
    .from('venues')
    .upsert(
      { name: address, lat: coords.lat, lng: coords.lng, address },
      { onConflict: 'address' }
    )
    .select()
    .single()

  if (venueError) return NextResponse.json({ error: venueError.message }, { status: 500 })

  // Upsert act
  const { data: actData, error: actError } = await supabase
    .from('acts')
    .upsert({ name: bandName, genre }, { onConflict: 'name' })
    .select()
    .single()

  if (actError) return NextResponse.json({ error: actError.message }, { status: 500 })

  // Insert set
  const { error: setError } = await supabase.from('sets').insert({
    venue_id: venueData.id,
    act_id: actData.id,
    starts_at: new Date(startTime).toISOString(),
    ends_at: new Date(endTime).toISOString(),
    status: 'scheduled',
  })

  if (setError) return NextResponse.json({ error: setError.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
