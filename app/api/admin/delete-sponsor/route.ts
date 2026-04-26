import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  const token = req.headers.get('x-admin-token')
  if (token !== process.env.ADMIN_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { sponsorId } = await req.json()

  if (!sponsorId) {
    return NextResponse.json({ error: 'Missing sponsorId' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { error } = await supabase.from('sponsors').delete().eq('id', sponsorId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
