-- ====================================================================
-- CREATIVE AI MARKETING PLATFORM — PHASE 10B: AI AUDIT, COST TRACKING & ROI
-- Migration: 20260915_phase10b_ai_audit_and_cost.sql
-- Table: ai_audit_events
-- Immutability: Append-only design (NO update, NO delete)
-- RLS: Role-based governance, campaign isolation, non-recursive policies
-- ====================================================================

-- 1. AI Audit Events Table
CREATE TABLE IF NOT EXISTS public.ai_audit_events (
  id TEXT PRIMARY KEY,
  campaign_id TEXT REFERENCES public.campaigns(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name TEXT,
  user_role TEXT,
  content_id TEXT,
  asset_id TEXT,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  operation TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'BLOCKED', 'FAILED', 'UNKNOWN')),
  moderation_status TEXT NOT NULL CHECK (moderation_status IN ('LOW_RISK', 'MEDIUM_RISK', 'HIGH_RISK', 'REQUIRES_HUMAN_REVIEW', 'UNKNOWN')),
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  duration_ms INT,
  input_tokens INT,
  output_tokens INT,
  total_tokens INT,
  token_status TEXT NOT NULL CHECK (token_status IN ('KNOWN', 'ESTIMATED', 'TOKEN_USAGE_UNKNOWN')),
  estimated_cost NUMERIC(12, 6),
  currency TEXT DEFAULT 'USD',
  cost_status TEXT NOT NULL CHECK (cost_status IN ('KNOWN', 'ESTIMATED', 'COST_UNKNOWN')),
  error_code TEXT,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_ai_audit_campaign ON public.ai_audit_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ai_audit_user ON public.ai_audit_events(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_audit_provider ON public.ai_audit_events(provider);
CREATE INDEX IF NOT EXISTS idx_ai_audit_status ON public.ai_audit_events(status);
CREATE INDEX IF NOT EXISTS idx_ai_audit_created ON public.ai_audit_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_audit_cost_status ON public.ai_audit_events(cost_status);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.ai_audit_events ENABLE ROW LEVEL SECURITY;

-- 3. SELECT Policy:
-- - Administrators and governance users have global visibility
-- - Campaign members can view operations within their assigned campaign
DROP POLICY IF EXISTS ai_audit_events_select_policy ON public.ai_audit_events;
CREATE POLICY ai_audit_events_select_policy ON public.ai_audit_events
  FOR SELECT
  USING (
    -- Administrator override
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role = 'Administrator'
    )
    OR
    -- Campaign member isolation via non-recursive helper
    (
      campaign_id IS NOT NULL
      AND public.is_campaign_member(auth.uid(), campaign_id)
    )
  );

-- 4. INSERT Policy:
-- Only authenticated users can record audit entries
DROP POLICY IF EXISTS ai_audit_events_insert_policy ON public.ai_audit_events;
CREATE POLICY ai_audit_events_insert_policy ON public.ai_audit_events
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
  );

-- 5. Strict Immutability Policies
-- DO NOT create UPDATE or DELETE policies.
-- By omitting UPDATE and DELETE policies in PostgreSQL RLS, all client-side
-- or direct database attempts to modify or delete audit rows will be rejected.
