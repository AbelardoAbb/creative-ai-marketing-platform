-- ==============================================================================
-- CREATIVE AI MARKETING PLATFORM — PHASE 6 MIGRATION
-- Campaign Management, Expanded Briefing Model, and RLS
-- ==============================================================================

-- 1. App Role Enum (Ensure it exists from Phase 5)
DO $$ BEGIN
  CREATE TYPE app_role AS ENUM ('Designer', 'Copywriter', 'Approver', 'Administrator');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. User Roles Table (Ensure it exists from Phase 5)
CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'Designer',
  account_status TEXT NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'suspended', 'pending_verification')),
  assigned_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Campaigns Table (Phase 6 Complete Information Model)
CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  client TEXT NOT NULL DEFAULT 'Geral',
  description TEXT,
  product_or_service TEXT,
  campaign_objective TEXT,
  target_audience TEXT,
  key_message TEXT,
  tone_of_voice TEXT,
  language TEXT NOT NULL DEFAULT 'pt-BR',
  channels TEXT[] NOT NULL DEFAULT ARRAY['Instagram', 'LinkedIn']::TEXT[],
  visual_direction TEXT,
  creative_constraints TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'in_review', 'completed', 'archived')),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- In case table already exists with minimal columns, alter it to add new columns safely
DO $$ BEGIN
  ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS client TEXT NOT NULL DEFAULT 'Geral';
  ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS product_or_service TEXT;
  ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS campaign_objective TEXT;
  ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS target_audience TEXT;
  ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS key_message TEXT;
  ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS tone_of_voice TEXT;
  ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'pt-BR';
  ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS channels TEXT[] NOT NULL DEFAULT ARRAY['Instagram', 'LinkedIn']::TEXT[];
  ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS visual_direction TEXT;
  ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS creative_constraints TEXT;
EXCEPTION
  WHEN others THEN null;
END $$;

-- 4. Campaign Members Table
CREATE TABLE IF NOT EXISTS public.campaign_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'Designer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_campaign_member UNIQUE (campaign_id, user_id)
);

-- ------------------------------------------------------------------------------
-- SECURITY DEFINER HELPER FUNCTIONS (Non-Recursive RLS Foundation)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin(check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = check_user_id
      AND role = 'Administrator'
      AND account_status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_campaign_member(check_campaign_id UUID, check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.campaign_members
    WHERE campaign_id = check_campaign_id
      AND user_id = check_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_campaign_creator(check_campaign_id UUID, check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.campaigns
    WHERE id = check_campaign_id
      AND created_by = check_user_id
  );
$$;

-- ------------------------------------------------------------------------------
-- ROW-LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------

-- 1. Table: campaigns
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Campaign view policy" ON public.campaigns;
CREATE POLICY "Campaign view policy"
  ON public.campaigns FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR public.is_admin(auth.uid())
    OR public.is_campaign_member(id, auth.uid())
  );

DROP POLICY IF EXISTS "Campaign create policy" ON public.campaigns;
CREATE POLICY "Campaign create policy"
  ON public.campaigns FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
  );

DROP POLICY IF EXISTS "Campaign update policy" ON public.campaigns;
CREATE POLICY "Campaign update policy"
  ON public.campaigns FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR public.is_admin(auth.uid())
    OR public.is_campaign_member(id, auth.uid())
  )
  WITH CHECK (
    created_by = auth.uid()
    OR public.is_admin(auth.uid())
    OR public.is_campaign_member(id, auth.uid())
  );

DROP POLICY IF EXISTS "Campaign delete policy" ON public.campaigns;
CREATE POLICY "Campaign delete policy"
  ON public.campaigns FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR public.is_admin(auth.uid())
  );

-- 2. Table: campaign_members
ALTER TABLE public.campaign_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Campaign members view policy" ON public.campaign_members;
CREATE POLICY "Campaign members view policy"
  ON public.campaign_members FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_admin(auth.uid())
    OR public.is_campaign_member(campaign_id, auth.uid())
  );

DROP POLICY IF EXISTS "Campaign members insert policy" ON public.campaign_members;
CREATE POLICY "Campaign members insert policy"
  ON public.campaign_members FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin(auth.uid())
    OR public.is_campaign_creator(campaign_id, auth.uid())
  );

DROP POLICY IF EXISTS "Campaign members delete policy" ON public.campaign_members;
CREATE POLICY "Campaign members delete policy"
  ON public.campaign_members FOR DELETE TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.is_campaign_creator(campaign_id, auth.uid())
  );
