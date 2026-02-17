import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * サーバーコンポーネント・Route Handler・Server Action 用 Supabase クライアント。
 * Next.js の cookies() を通じてセッションを管理します。
 * サーバーサイドでのみ使用してください。
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component から呼び出された場合は set が失敗することがあります。
            // セッションの更新は middleware.ts の updateSession が担うため無視します。
          }
        },
      },
    }
  )
}
