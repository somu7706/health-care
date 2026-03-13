
CREATE TABLE public.wearable_health_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  heart_rate integer,
  steps integer,
  sleep_hours numeric(4,2),
  calories integer,
  distance numeric(8,2),
  source text DEFAULT 'manual',
  recorded_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.wearable_health_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own wearable data" ON public.wearable_health_data FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own wearable data" ON public.wearable_health_data FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own wearable data" ON public.wearable_health_data FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own wearable data" ON public.wearable_health_data FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_wearable_user_recorded ON public.wearable_health_data(user_id, recorded_at DESC);
