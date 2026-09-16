-- ====================================================================
-- CREATIVE AI MARKETING PLATFORM — PHASE 8: CONTENT & CLAUDE INTEGRATION
-- Migration: 20260914_phase8_content_claude_editor.sql
-- Tables: contents, content_versions, ai_generation_logs
-- RLS: Campaign-scoped read/write and Administrator audit
-- ====================================================================

-- 1. Contents Table
CREATE TABLE IF NOT EXISTS public.contents (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Conteúdo Sem Título',
  channel TEXT NOT NULL DEFAULT 'Social Media',
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'AI_GENERATED', 'HUMAN_EDITED', 'READY_FOR_REVIEW')),
  current_version INT NOT NULL DEFAULT 1,
  content TEXT NOT NULL DEFAULT '',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by_name TEXT,
  created_by_role TEXT,
  rating INT CHECK (rating >= 1 AND rating <= 5),
  evaluation_feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contents_campaign ON public.contents(campaign_id);
CREATE INDEX IF NOT EXISTS idx_contents_created_by ON public.contents(created_by);
CREATE INDEX IF NOT EXISTS idx_contents_status ON public.contents(status);

-- 2. Content Versions Table (Append-only history, never destroys previous records)
CREATE TABLE IF NOT EXISTS public.content_versions (
  id TEXT PRIMARY KEY,
  content_id TEXT NOT NULL REFERENCES public.contents(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  source_version INT,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name TEXT,
  author_role TEXT,
  provider TEXT,
  model TEXT,
  operation TEXT,
  content TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_content_version UNIQUE (content_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_content_versions_content_id ON public.content_versions(content_id);

-- 3. AI Generation Logs Table
CREATE TABLE IF NOT EXISTS public.ai_generation_logs (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  content_id TEXT REFERENCES public.contents(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  operation TEXT NOT NULL,
  status TEXT NOT NULL
    CHECK (status IN ('COMPLETED', 'BLOCKED', 'RATE_LIMITED', 'TIMEOUT', 'VALIDATION_ERROR', 'CONTROLLED_ERROR')),
  duration_ms INT,
  tokens_input TEXT,
  tokens_output TEXT,
  estimated_cost TEXT,
  error_message TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_logs_campaign ON public.ai_generation_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ai_logs_user ON public.ai_generation_logs(user_id);

-- 4. Enable RLS
ALTER TABLE public.contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_generation_logs ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for contents
DROP POLICY IF EXISTS contents_select_member ON public.contents;
CREATE POLICY contents_select_member ON public.contents
  FOR SELECT
  USING (
    public.is_campaign_member(campaign_id, auth.uid()) OR
    public.has_role(auth.uid(), 'Administrator')
  );

DROP POLICY IF EXISTS contents_insert_author ON public.contents;
CREATE POLICY contents_insert_author ON public.contents
  FOR INSERT
  WITH CHECK (
    (public.is_campaign_member(campaign_id, auth.uid()) OR public.has_role(auth.uid(), 'Administrator'))
    AND auth.uid() = created_by
  );

DROP POLICY IF EXISTS contents_update_member ON public.contents;
CREATE POLICY contents_update_member ON public.contents
  FOR UPDATE
  USING (
    public.is_campaign_member(campaign_id, auth.uid()) OR
    public.has_role(auth.uid(), 'Administrator')
  );

-- 6. RLS Policies for content_versions
DROP POLICY IF EXISTS versions_select_member ON public.content_versions;
CREATE POLICY versions_select_member ON public.content_versions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.contents c
      WHERE c.id = content_versions.content_id
        AND (public.is_campaign_member(c.campaign_id, auth.uid()) OR public.has_role(auth.uid(), 'Administrator'))
    )
  );

DROP POLICY IF EXISTS versions_insert_author ON public.content_versions;
CREATE POLICY versions_insert_author ON public.content_versions
  FOR INSERT
  WITH CHECK (
    auth.uid() = author_id AND
    EXISTS (
      SELECT 1 FROM public.contents c
      WHERE c.id = content_versions.content_id
        AND (public.is_campaign_member(c.campaign_id, auth.uid()) OR public.has_role(auth.uid(), 'Administrator'))
    )
  );

-- 7. RLS Policies for ai_generation_logs
DROP POLICY IF EXISTS ai_logs_select_policy ON public.ai_generation_logs;
CREATE POLICY ai_logs_select_policy ON public.ai_generation_logs
  FOR SELECT
  USING (
    public.is_campaign_member(campaign_id, auth.uid()) OR
    public.has_role(auth.uid(), 'Administrator')
  );

DROP POLICY IF EXISTS ai_logs_insert_policy ON public.ai_generation_logs;
CREATE POLICY ai_logs_insert_policy ON public.ai_generation_logs
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    (public.is_campaign_member(campaign_id, auth.uid()) OR public.has_role(auth.uid(), 'Administrator'))
  );
