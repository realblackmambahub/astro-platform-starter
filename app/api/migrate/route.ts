import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const supabase = createClient()

    // Add missing columns to download_events
    const { error } = await supabase.rpc('add_geolocation_columns')

    if (error && !error.message.includes('already exists')) {
      console.error('[v0] Migration error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Migration completed successfully' })
  } catch (err) {
    console.error('[v0] Migration failed:', err)
    return NextResponse.json({ error: 'Migration failed' }, { status: 500 })
  }
}
