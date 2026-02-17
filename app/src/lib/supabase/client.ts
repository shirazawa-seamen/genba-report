import { createBrowserClient } from '@supabase/ssr'

/**
 * ブラウザ（クライアントコンポーネント）用 Supabase クライアント。
 * クライアントコンポーネント内でのみ使用してください。
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
