import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Middleware でセッションを更新する関数。
 *
 * Supabase Auth はアクセストークンを自動的にリフレッシュします。
 * この関数を Next.js の middleware から呼び出すことで、
 * セッションの期限切れを防ぎます。
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // リクエストに Cookie をセット（後続の Server Component が参照できるようにする）
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          // レスポンスを再生成して Cookie をブラウザへ送信する
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getUser() を呼ぶことでセッションのリフレッシュが行われます。
  // この呼び出しは削除しないでください。
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { supabaseResponse, user }
}
