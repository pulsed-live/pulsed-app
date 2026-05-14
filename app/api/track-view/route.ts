import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  try {
    const { event_id, session_id } = await req.json()
    if (!event_id || !session_id) {
      return NextResponse.json({ error: 'missing fields' }, { status: 400 })
    }

    const ua = req.headers.get('user-agent') ?? ''
    const is_mobile = /iPhone|iPad|Android|Mobile/i.test(ua)

    await supabase.from('page_views').insert({ event_id, session_id, is_mobile })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false })
  }
}
