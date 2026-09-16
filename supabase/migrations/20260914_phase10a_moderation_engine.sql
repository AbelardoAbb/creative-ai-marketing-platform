-- ====================================================================
-- CREATIVE AI MARKETING PLATFORM — PHASE 10A: MODERATION & RESPONSIBLE AI
-- Migration: 20260914_phase10a_moderation_engine.sql
-- Table: moderation_events
-- Extends: contents (moderation_status, moderation_risk, moderation_notes)
-- RLS: Campaign-scoped isolation, Approver-only resolutions, immutable audit log
-- ====================================================================

-- 1. Extend contents table with moderation tracking columns
ALTER TABLE public.contents
  ADD COLUMN IF NOT EXISTS moderation_status TEXT DEFAULT 'LOW_RISK'
    CHECK (moderation_status IN ('PENDING', 'LOW_RISK', 'MEDIUM_RISK', 'HIGH_RISK', 'REQUIRES_HUMAN_REVIEW', 'BLOCKED')),
  ADD COLUMN IF NOT EXISTS moderation_risk TEXT DEFAULT 'LOW_RISK'
    CHECK (moderation_risk IN ('LOW_RISK', 'MEDIUM_RISK', 'HIGH_RISK')),
  ADD COLUMN IF NOT EXISTS moderation_notes TEXT;

-- 2. Moderation Events Table (Append-only Audit Log with Resolution Tracking)
CREATE TABLE IF NOT EXISTS public.moderation_events (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name TEXT,
  user_role TEXT,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('content', 'image_asset', 'prompt')),
  resource_id TEXT,
  version_number INT,
  stage TEXT NOT NULL CHECK (stage IN ('INPUT', 'OUTPUT', 'HUMAN_OVERRIDE')),
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  operation TEXT,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('LOW_RISK', 'MEDIUM_RISK', 'HIGH_RISK')),
  decision TEXT NOT NULL CHECK (decision IN ('ALLOW', 'REQUIRES_HUMAN_REVIEW', 'BLOCK')),
  categories JSONB DEFAULT '[]'::jsonb,
  reason TEXT,
  evaluated_snippet TEXT,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'LOW_RISK', 'MEDIUM_RISK', 'HIGH_RISK', 'REQUIRES_HUMAN_REVIEW', 'BLOCKED')),
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_by_name TEXT,
  resolved_by_role TEXT,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  resolution_decision TEXT CHECK (resolution_decision IN ('ALLOW', 'BLOCK')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mod_events_campaign ON public.moderation_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_mod_events_resource ON public.moderation_events(resource_id);
CREATE INDEX IF NOT EXISTS idx_mod_events_status ON public.moderation_events(status);
CREATE INDEX IF NOT EXISTS idx_mod_events_user ON public.moderation_events(user_id);
CREATE INDEX IF NOT EXISTS idx_mod_events_created ON public.moderation_events(created_at DESC);

-- 3. Row Level Security on moderation_events
ALTER TABLE public.moderation_events ENABLE ROW LEVEL SECURITY;

-- 3.1 SELECT Policy: Campaign members or Administrator
DROP POLICY IF EXISTS moderation_events_select_policy ON public.moderation_events;
CREATE POLICY moderation_events_select_policy ON public.moderation_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'Administrator'
    )
    OR
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = moderation_events.campaign_id AND c.created_by = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.campaign_members cm
      WHERE cm.campaign_id = moderation_events.campaign_id AND cm.user_id = auth.uid()
    )
  );

-- 3.2 INSERT Policy: Campaign members can log moderation events for their own actions
DROP POLICY IF EXISTS moderation_events_insert_policy ON public.moderation_events;
CREATE POLICY moderation_events_insert_policy ON public.moderation_events
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'Administrator'
      )
      OR
      EXISTS (
        SELECT 1 FROM public.campaigns c
        WHERE c.id = campaign_id AND c.created_by = auth.uid()
      )
      OR
      EXISTS (
        SELECT 1 FROM public.campaign_members cm
        WHERE cm.campaign_id = campaign_id AND cm.user_id = auth.uid()
      )
    )
  );

-- 3.3 UPDATE Policy: Only Approver or Administrator can update (resolve) moderation events
DROP POLICY IF EXISTS moderation_events_update_policy ON public.moderation_events;
CREATE POLICY moderation_events_update_policy ON public.moderation_events
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('Approver', 'Administrator')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('Approver', 'Administrator')
    )
  );

-- 3.4 DELETE Policy: Moderation events are strictly append-only; direct DELETE is disallowed
DROP POLICY IF EXISTS moderation_events_delete_policy ON public.moderation_events;
CREATE POLICY moderation_events_delete_policy ON public.moderation_events
  FOR DELETE
  USING (false);
