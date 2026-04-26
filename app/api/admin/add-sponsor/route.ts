import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { geocode } from '@/lib/geocode'

export async function POST(req: NextRequest) {
  const token = req.headers.get('x-admin-token')
  if (token !== process.env.ADMIN_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { name, address, url } = await req.json()

  if (!name || !address) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const coords = await geocode(address)
  if (!coords) {
    return NextResponse.json(
      { error: 'Could not find that address. Try adding the street name + "Atlanta GA".' },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()
  const { error } = await supabase.from('sponsors').insert({
    name,
    address,
    lat: coords.lat,
    lng: coords.lng,
    url: url || null,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
