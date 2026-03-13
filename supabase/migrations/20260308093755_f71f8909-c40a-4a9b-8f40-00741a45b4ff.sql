
-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name TEXT,
  email TEXT,
  age INTEGER,
  gender TEXT,
  location TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Medical reports
CREATE TABLE public.medical_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  file_url TEXT,
  report_text TEXT,
  report_type TEXT,
  summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE public.medical_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own reports" ON public.medical_reports FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own reports" ON public.medical_reports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own reports" ON public.medical_reports FOR DELETE USING (auth.uid() = user_id);

-- Medicines
CREATE TABLE public.medicines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  dosage TEXT,
  frequency TEXT,
  duration TEXT,
  source_report TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE public.medicines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own medicines" ON public.medicines FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own medicines" ON public.medicines FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own medicines" ON public.medicines FOR DELETE USING (auth.uid() = user_id);

-- Symptoms
CREATE TABLE public.symptoms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  symptom TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE public.symptoms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own symptoms" ON public.symptoms FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own symptoms" ON public.symptoms FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own symptoms" ON public.symptoms FOR DELETE USING (auth.uid() = user_id);

-- Disease stages
CREATE TABLE public.disease_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  disease TEXT NOT NULL,
  stage TEXT,
  confidence INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE public.disease_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own disease stages" ON public.disease_stages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own disease stages" ON public.disease_stages FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Care plans
CREATE TABLE public.care_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  plan JSONB,
  disease TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE public.care_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own care plans" ON public.care_plans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own care plans" ON public.care_plans FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Precautions
CREATE TABLE public.precautions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  precaution TEXT NOT NULL,
  disease TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE public.precautions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own precautions" ON public.precautions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own precautions" ON public.precautions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT,
  message TEXT,
  schedule_time TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own notifications" ON public.notifications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

-- Storage bucket for medical reports
INSERT INTO storage.buckets (id, name, public) VALUES ('medical-reports', 'medical-reports', false);

CREATE POLICY "Users can upload own reports" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'medical-reports' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can view own reports" ON storage.objects FOR SELECT USING (bucket_id = 'medical-reports' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own reports" ON storage.objects FOR DELETE USING (bucket_id = 'medical-reports' AND auth.uid()::text = (storage.foldername(name))[1]);
