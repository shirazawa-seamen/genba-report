-- ============================================================
-- 現場報告システム マイグレーション v6
-- ユーザー管理機能の追加
-- Supabase SQL Editor で実行してください
-- ============================================================

-- profiles に is_active カラム追加
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'is_active'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN is_active boolean NOT NULL DEFAULT true;
    END IF;
END $$;

-- admin が任意のプロフィールを更新可能にする RLS ポリシー
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'profiles_update_admin') THEN
        CREATE POLICY "profiles_update_admin" ON public.profiles
            FOR UPDATE TO authenticated
            USING (
                EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
            );
    END IF;
END $$;

-- admin がプロフィールを挿入可能にする（招待時）
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'profiles_insert_admin') THEN
        CREATE POLICY "profiles_insert_admin" ON public.profiles
            FOR INSERT TO authenticated
            WITH CHECK (
                auth.uid() = id
                OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
            );
    END IF;
END $$;
