
-- Add UPDATE policy for disease_stages
CREATE POLICY "Users can update own disease stages" ON public.disease_stages FOR UPDATE USING (auth.uid() = user_id);

-- Add DELETE policy for notifications
CREATE POLICY "Users can delete own notifications" ON public.notifications FOR DELETE USING (auth.uid() = user_id);
