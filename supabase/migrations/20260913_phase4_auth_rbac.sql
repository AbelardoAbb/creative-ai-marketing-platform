-- ====================================================================
-- CREATIVE AI MARKETING PLATFORM — PHASE 4: AUTH & RBAC FOUNDATION
-- Migration: 20260913_phase4_auth_rbac.sql
-- Description: Establishes user roles, status, and RLS policies for Phase 4.
-- ====================================================================

-- 1. Create custom role enum type
DO $$ BEGIN
  CREATE TYPE app_role AS ENUM ('Designer', 'Copywriter', 'Approver', 'Administrator');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Create minimal user_roles table linked to Supabase auth.users
-- Avoids duplicating email, password or metadata managed natively by auth.users
CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'Designer',
  account_status TEXT NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'suspended', 'pending_verification')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Enable Row-Level Security (RLS)
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for Phase 4:
-- Policy 1: Authenticated users can view their own role
CREATE POLICY "Users can read own role"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy 2: Administrators can view all user roles
CREATE POLICY "Administrators can read all roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'Administrator'
    )
  );

-- Policy 3: Only Service Role or Administrators can insert/update roles
CREATE POLICY "Administrators can manage roles"
  ON public.user_roles
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'Administrator'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'Administrator'
    )
  );

-- 5. Trigger to automatically provision a user_role record upon auth.users signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  initial_role app_role := 'Designer';
BEGIN
  -- If metadata specifies a valid initial role (e.g. during invited onboarding), assign it safely
  IF (NEW.raw_user_meta_data->>'role') IN ('Designer', 'Copywriter', 'Approver', 'Administrator') THEN
    initial_role := (NEW.raw_user_meta_data->>'role')::app_role;
  END IF;

  INSERT INTO public.user_roles (user_id, role, account_status)
  VALUES (NEW.id, initial_role, 'active')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ====================================================================
-- RLS STRATEGY DOCUMENTATION (PROGRESSIVE IMPLEMENTATION):
-- - Phase 4 (Current): user_roles table with self-read and Admin-manage policies.
-- - Phase 5/6 (Future): campaigns and campaign_members RLS (isolation by team).
-- - Phase 7/8 (Future): visual_assets and content_pieces RLS (creator/team access).
-- - Phase 11 (Future): approvals RLS (strictly enforcing Approver role and author != reviewer).
-- ====================================================================
