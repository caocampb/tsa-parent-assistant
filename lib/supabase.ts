import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Simple client for now - we'll add SSR later if needed
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
