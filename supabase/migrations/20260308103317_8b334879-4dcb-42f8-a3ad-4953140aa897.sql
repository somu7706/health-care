CREATE TABLE public.health_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  disease text,
  stage text,
  stage_confidence integer,
  care_plan jsonb,
  diet_plan jsonb,
  precautions jsonb,
  medicines jsonb,
  summary text,
  last_updated timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.health_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own health profiles" ON public.health_profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own health profiles" ON public.health_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own health profiles" ON public.health_profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own health profiles" ON public.health_profiles FOR DELETE TO authenticated USING (auth.uid() = user_id);