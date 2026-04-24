import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Venue = {
  id: string
  name: string
  lat: number
  lng: number
  address: string
}

export type Act = {
  id: string
  name: string
  genre: string
  link?: string
}

export type SetRow = {
  id: string
  venue_id: string
  act_id: string
  starts_at: string
  ends_at: string
  status: 'scheduled' | 'live' | 'running_late' | 'cancelled'
  venues?: Venue
  acts?: Act
}
