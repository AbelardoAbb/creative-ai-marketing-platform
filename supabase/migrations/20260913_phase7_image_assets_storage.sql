-- ==============================================================================
-- CREATIVE AI MARKETING PLATFORM — PHASE 7 MIGRATION
-- Image Generation Assets, Evaluations, and Event Logs
-- ==============================================================================

-- 1. Asset Status Enum
DO $$ BEGIN
  CREATE TYPE image_asset_status AS ENUM (
    'GENERATED',
    'MODERATION_REVIEW',
    'MODERATION_BLOCKED',
    'READY_FOR_REVIEW'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Moderation Risk Enum
DO $$ BEGIN
  CREATE TYPE moderation_risk_level AS ENUM (
    'LOW_RISK',
    'MEDIUM_RISK',
    'HIGH_RISK'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. Image Assets Table
CREATE TABLE IF NOT EXISTS public.image_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'stability_ai',
  model TEXT NOT NULL DEFAULT 'stable-image-core',
  prompt TEXT NOT NULL,
  negative_prompt TEXT,
  style TEXT NOT NULL DEFAULT 'Advertising',
  aspect_ratio TEXT NOT NULL DEFAULT '1:1',
  status TEXT NOT NULL DEFAULT 'GENERATED' CHECK (status IN ('GENERATED', 'MODERATION_REVIEW', 'MODERATION_BLOCKED', 'READY_FOR_REVIEW')),
  moderation_status TEXT NOT NULL DEFAULT 'LOW_RISK' CHECK (moderation_status IN ('LOW_RISK', 'MEDIUM_RISK', 'HIGH_RISK')),
  moderation_notes TEXT,
  storage_path TEXT NOT NULL,
  public_url TEXT,
  width INT NOT NULL DEFAULT 1024,
  height INT NOT NULL DEFAULT 1024,
  rating SMALLINT CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,
  generation_duration_ms INT,
  estimated_cost TEXT NOT NULL DEFAULT '0.030 USD',
  parent_asset_id UUID REFERENCES public.image_assets(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_image_assets_campaign ON public.image_assets(campaign_id);
CREATE INDEX IF NOT EXISTS idx_image_assets_creator ON public.image_assets(created_by);
CREATE INDEX IF NOT EXISTS idx_image_assets_status ON public.image_assets(status);

-- 4. Generation Event Logs Table (Audit & Cost Safeguards)
CREATE TABLE IF NOT EXISTS public.image_generation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES public.image_assets(id) ON DELETE SET NULL,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  generation_status TEXT NOT NULL CHECK (generation_status IN ('SUCCESS', 'ERROR', 'BLOCKED')),
  moderation_status TEXT NOT NULL,
  generation_duration_ms INT,
  estimated_cost TEXT NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_generation_logs_campaign ON public.image_generation_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_generation_logs_user ON public.image_generation_logs(user_id);

-- 5. Row Level Security Policies
ALTER TABLE public.image_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.image_generation_logs ENABLE ROW LEVEL SECURITY;

-- Non-recursive helper: Check if user has campaign access for image assets
CREATE OR REPLACE FUNCTION public.can_access_campaign_assets(p_campaign_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'Administrator'
  ) OR EXISTS (
    SELECT 1 FROM public.campaigns WHERE id = p_campaign_id AND created_by = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.campaign_members WHERE campaign_id = p_campaign_id AND user_id = auth.uid()
  );
$$;

DROP POLICY IF EXISTS "Users can view assets of accessible campaigns" ON public.image_assets;
CREATE POLICY "Users can view assets of accessible campaigns"
  ON public.image_assets FOR SELECT
  USING (public.can_access_campaign_assets(campaign_id));

DROP POLICY IF EXISTS "Designers and Admins can insert assets" ON public.image_assets;
CREATE POLICY "Designers and Admins can insert assets"
  ON public.image_assets FOR INSERT
  WITH CHECK (
    public.can_access_campaign_assets(campaign_id)
    AND auth.uid() = created_by
  );

DROP POLICY IF EXISTS "Asset evaluation and updates" ON public.image_assets;
CREATE POLICY "Asset evaluation and updates"
  ON public.image_assets FOR UPDATE
  USING (public.can_access_campaign_assets(campaign_id));
