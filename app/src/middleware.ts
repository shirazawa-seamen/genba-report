import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

/**
 * 認証が必要なルートを保護する Next.js Middleware。
 *
 * - /login および /auth/** へのアクセスは未認証でも許可します。
 * - それ以外のルートは認証済みユーザーのみアクセスできます。
 *   未認証の場合は /login へリダイレクトします。
 */
export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request)

  const { pathname } = request.nextUrl

  // 認証不要なパスは通過させる
  const isPublicPath =
    pathname === '/login' ||
    pathname.startsWith('/auth/')

  if (!user && !isPublicPath) {
    // 未認証 & 保護されたルート → /login へリダイレクト
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    // ログイン後に元のページへ戻れるよう redirect パラメータを付与
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (user && pathname === '/login') {
    // 認証済みなのに /login へアクセスした場合はトップページへリダイレクト
    const homeUrl = request.nextUrl.clone()
    homeUrl.pathname = '/'
    homeUrl.searchParams.delete('redirect')
    return NextResponse.redirect(homeUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * 以下のパスを除くすべてのルートに Middleware を適用します。
     * - _next/static  (静的ファイル)
     * - _next/image   (画像最適化)
     * - favicon.ico   (ファビコン)
     * - public フォルダ配下の静的アセット
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
