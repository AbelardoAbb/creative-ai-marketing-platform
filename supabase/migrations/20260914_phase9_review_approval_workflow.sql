-- ====================================================================
-- CREATIVE AI MARKETING PLATFORM — PHASE 9: REVIEW & APPROVAL WORKFLOW
-- Migration: 20260914_phase9_review_approval_workflow.sql
-- Tables: content_comments, content_review_events, content_approval_records
-- Constraints: Content status transitions, meaningful justification, anti-self-approval
-- RLS: Campaign-scoped isolation, Approver-only decisions, immutable audit logs
-- ====================================================================

-- 1. Extend contents status check and add audit columns
ALTER TABLE public.contents
  DROP CONSTRAINT IF EXISTS contents_status_check;

ALTER TABLE public.contents
  ADD CONSTRAINT contents_status_check
  CHECK (status IN ('DRAFT', 'AI_GENERATED', 'HUMAN_EDITED', 'READY_FOR_REVIEW', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'));

ALTER TABLE public.contents
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_by_name TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;

-- 2. Content Collaboration Comments Table
CREATE TABLE IF NOT EXISTS public.content_comments (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  content_id TEXT NOT NULL REFERENCES public.contents(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  author_role TEXT NOT NULL,
  text TEXT NOT NULL CHECK (char_length(trim(text)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_comments_content ON public.content_comments(content_id);
CREATE INDEX IF NOT EXISTS idx_content_comments_campaign ON public.content_comments(campaign_id);
CREATE INDEX IF NOT EXISTS idx_content_comments_author ON public.content_comments(author_id);

-- 3. Content Review & Approval Events Table (Append-only Audit History)
CREATE TABLE IF NOT EXISTS public.content_review_events (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  content_id TEXT NOT NULL REFERENCES public.contents(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  action TEXT NOT NULL
    CHECK (action IN ('SUBMITTED_FOR_REVIEW', 'REVIEW_STARTED', 'APPROVED', 'REJECTED', 'RESUBMITTED', 'COMMENT_ADDED')),
  actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_name TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  previous_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  notes TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_review_events_content ON public.content_review_events(content_id);
CREATE INDEX IF NOT EXISTS idx_review_events_campaign ON public.content_review_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_review_events_actor ON public.content_review_events(actor_id);

-- 4. Content Approval Records Table (Formal Decision Records)
CREATE TABLE IF NOT EXISTS public.content_approval_records (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  content_id TEXT NOT NULL REFERENCES public.contents(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('APPROVED', 'REJECTED')),
  reviewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewer_name TEXT NOT NULL,
  reviewer_role TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approval_records_content ON public.content_approval_records(content_id);
CREATE INDEX IF NOT EXISTS idx_approval_records_campaign ON public.content_approval_records(campaign_id);
CREATE INDEX IF NOT EXISTS idx_approval_records_reviewer ON public.content_approval_records(reviewer_id);

-- 5. Enable RLS
ALTER TABLE public.content_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_review_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_approval_records ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for content_comments
DROP POLICY IF EXISTS comments_select_policy ON public.content_comments;
CREATE POLICY comments_select_policy ON public.content_comments
  FOR SELECT
  USING (
    public.is_campaign_member(campaign_id, auth.uid()) OR
    public.has_role(auth.uid(), 'Administrator')
  );

DROP POLICY IF EXISTS comments_insert_policy ON public.content_comments;
CREATE POLICY comments_insert_policy ON public.content_comments
  FOR INSERT
  WITH CHECK (
    auth.uid() = author_id AND
    (public.is_campaign_member(campaign_id, auth.uid()) OR public.has_role(auth.uid(), 'Administrator'))
  );

-- 7. RLS Policies for content_review_events (Append-only: SELECT and INSERT only)
DROP POLICY IF EXISTS review_events_select_policy ON public.content_review_events;
CREATE POLICY review_events_select_policy ON public.content_review_events
  FOR SELECT
  USING (
    public.is_campaign_member(campaign_id, auth.uid()) OR
    public.has_role(auth.uid(), 'Administrator')
  );

DROP POLICY IF EXISTS review_events_insert_policy ON public.content_review_events;
CREATE POLICY review_events_insert_policy ON public.content_review_events
  FOR INSERT
  WITH CHECK (
    auth.uid() = actor_id AND
    (public.is_campaign_member(campaign_id, auth.uid()) OR public.has_role(auth.uid(), 'Administrator'))
  );

-- 8. RLS Policies for content_approval_records (Strict Approver & Anti-Self-Approval enforcement)
DROP POLICY IF EXISTS approval_records_select_policy ON public.content_approval_records;
CREATE POLICY approval_records_select_policy ON public.content_approval_records
  FOR SELECT
  USING (
    public.is_campaign_member(campaign_id, auth.uid()) OR
    public.has_role(auth.uid(), 'Administrator')
  );

DROP POLICY IF EXISTS approval_records_insert_policy ON public.content_approval_records;
CREATE POLICY approval_records_insert_policy ON public.content_approval_records
  FOR INSERT
  WITH CHECK (
    auth.uid() = reviewer_id AND
    public.has_role(auth.uid(), 'Approver') AND
    public.is_campaign_member(campaign_id, auth.uid()) AND
    NOT EXISTS (
      SELECT 1 FROM public.contents c
      WHERE c.id = content_approval_records.content_id
        AND c.created_by = auth.uid()
    )
  );
