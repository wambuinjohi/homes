-- Fix user_tour_progress table schema
-- This table is used by the interactive tours feature

-- Drop the existing table if it exists with wrong schema
DROP TABLE IF EXISTS public.user_tour_progress CASCADE;

-- Create user_tour_progress table with correct schema
CREATE TABLE IF NOT EXISTS public.user_tour_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tour_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  last_step_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, tour_name)
);

-- Enable RLS
ALTER TABLE public.user_tour_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only see and manage their own tour progress
CREATE POLICY "Users can view their own tour progress" 
ON public.user_tour_progress
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tour progress" 
ON public.user_tour_progress
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tour progress" 
ON public.user_tour_progress
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tour progress" 
ON public.user_tour_progress
FOR DELETE
USING (auth.uid() = user_id);

-- Admins can view all tour progress
CREATE POLICY "Admins can view all tour progress"
ON public.user_tour_progress
FOR SELECT
USING (has_role_safe(auth.uid(), 'Admin'::app_role));

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_tour_progress_user_id ON public.user_tour_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tour_progress_tour_name ON public.user_tour_progress(tour_name);
CREATE INDEX IF NOT EXISTS idx_user_tour_progress_status ON public.user_tour_progress(status);