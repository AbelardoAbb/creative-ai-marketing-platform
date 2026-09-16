-- ==============================================================================
-- CREATIVE AI MARKETING PLATFORM — PHASE 5 MIGRATION
-- RBAC Refinement, Campaign Membership, and Non-Recursive RLS Foundation
-- ==============================================================================

-- 1. App Role Enum
DO $$ BEGIN
  CREATE TYPE app_role AS ENUM ('Designer', 'Copywriter', 'Approver', 'Administrator');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. User Roles Table
CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'Designer',
  account_status TEXT NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'suspended', 'pending_verification')),
  assigned_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Campaigns Table
CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'in_review', 'completed', 'archived')),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
--
-- Why these are secure:
-- 1. SET search_path = public, pg_temp: Prevents search_path injection attacks.
-- 2. Takes strictly typed UUID parameters; NO dynamic SQL or query concatenation.
-- 3. Only returns a scalar BOOLEAN.
-- 4. Bypasses recursive self-referential RLS evaluation on protected tables.
-- ------------------------------------------------------------------------------

-- Check if a user has the Administrator role without causing RLS recursion on user_roles
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

-- Check if a user is a member of a campaign without causing RLS recursion on campaign_members
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

-- Check if user is the creator of a campaign
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
-- MINIMUM RBAC CORRECTION: TRIGGER TO PREVENT PRIVILEGE ESCALATION ON SIGNUP
-- Newly registered users can NEVER self-assign 'Administrator' or 'Approver'.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  initial_role app_role := 'Designer';
  meta_role text;
BEGIN
  meta_role := NEW.raw_user_meta_data->>'role';

  -- Only allow safe, unprivileged creator roles from client metadata.
  -- Administrator and Approver are strictly forbidden from client metadata!
  IF meta_role = 'Copywriter' THEN
    initial_role := 'Copywriter'::app_role;
  ELSE
    initial_role := 'Designer'::app_role;
  END IF;

  INSERT INTO public.user_roles (user_id, role, account_status)
  VALUES (NEW.id, initial_role, 'active')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- ROW-LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------

-- 1. Table: user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own role" ON public.user_roles;
CREATE POLICY "Users can read own role"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Only Admins can insert or modify roles" ON public.user_roles;
CREATE POLICY "Only Admins can insert or modify roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 2. Table: campaigns
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- Non-recursive SELECT: user can see campaign if they are admin, creator, or member
DROP POLICY IF EXISTS "Campaign view policy" ON public.campaigns;
CREATE POLICY "Campaign view policy"
  ON public.campaigns FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR public.is_admin(auth.uid())
    OR public.is_campaign_member(id, auth.uid())
  );

-- INSERT: Authenticated users can create campaigns
DROP POLICY IF EXISTS "Campaign create policy" ON public.campaigns;
CREATE POLICY "Campaign create policy"
  ON public.campaigns FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
  );

-- UPDATE: Creator or Admin or Authorized Campaign Member
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

-- DELETE: Creator or Admin only
DROP POLICY IF EXISTS "Campaign delete policy" ON public.campaigns;
CREATE POLICY "Campaign delete policy"
  ON public.campaigns FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR public.is_admin(auth.uid())
  );

-- 3. Table: campaign_members
ALTER TABLE public.campaign_members ENABLE ROW LEVEL SECURITY;

-- SELECT: Users can view their own membership records, Admins can view all,
-- and members of the campaign can view member roster (via non-recursive helper)
DROP POLICY IF EXISTS "Campaign members view policy" ON public.campaign_members;
CREATE POLICY "Campaign members view policy"
  ON public.campaign_members FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_admin(auth.uid())
    OR public.is_campaign_member(campaign_id, auth.uid())
  );

-- INSERT: Only Admin or Campaign Creator can add members
-- (Prevents arbitrary self-assignment by normal users!)
DROP POLICY IF EXISTS "Campaign members insert policy" ON public.campaign_members;
CREATE POLICY "Campaign members insert policy"
  ON public.campaign_members FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin(auth.uid())
    OR public.is_campaign_creator(campaign_id, auth.uid())
  );

-- DELETE / UPDATE: Only Admin or Campaign Creator
DROP POLICY IF EXISTS "Campaign members delete policy" ON public.campaign_members;
CREATE POLICY "Campaign members delete policy"
  ON public.campaign_members FOR DELETE TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.is_campaign_creator(campaign_id, auth.uid())
  );
