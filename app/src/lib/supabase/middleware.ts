import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Middleware でセッションを更新する関数。
 *
 * Supabase Auth はアクセストークンを自動的にリフレッシュします。
 * この関数を Next.js の middleware から呼び出すことで、
 * セッションの期限切れを防ぎます。
 *
 * 注意: ここでは getSession() を使って Cookie からローカルに
 * セッションを読み取ります（Supabase へのネットワーク通信なし）。
 * セキュリティ上重要なデータ取得は Server Component 側の
 * getUser() で検証されるため、ミドルウェアでのルーティング判定は
 * getSession() で十分です。
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

  // getSession() は Cookie 内の JWT をローカルで読み取るだけで
  // Supabase への通信は発生しません。トークンのリフレッシュが
  // 必要な場合のみ Supabase と通信します。
  const {
    data: { session },
  } = await supabase.auth.getSession()

  return { supabaseResponse, user: session?.user ?? null }
}
