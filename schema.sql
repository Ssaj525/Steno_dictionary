-- Supabase Database Schema SQL Script for Steno Dictionary

CREATE TABLE IF NOT EXISTS public.steno_dictionary (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    english_meaning TEXT NOT NULL,
    image_url TEXT NOT NULL,
    is_word_of_day BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.steno_dictionary ENABLE ROW LEVEL SECURITY;

-- Allow read access to everyone
CREATE POLICY "Public Read Access" ON public.steno_dictionary
    FOR SELECT USING (true);

-- Allow insert access
CREATE POLICY "Public Insert Access" ON public.steno_dictionary
    FOR INSERT WITH CHECK (true);

-- Allow delete access
CREATE POLICY "Public Delete Access" ON public.steno_dictionary
    FOR DELETE USING (true);
