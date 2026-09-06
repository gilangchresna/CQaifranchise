-- Create staff table for workforce management
CREATE TABLE IF NOT EXISTS public.staff (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  outlet_id INTEGER REFERENCES public.outlets(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late')),
  shift_start TEXT,
  shift_end TEXT,
  contact TEXT,
  performance_score INTEGER DEFAULT 75,
  attendance_rate INTEGER DEFAULT 95,
  sales_handled DECIMAL(12,2) DEFAULT 0,
  hire_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read
CREATE POLICY "Authenticated users can read staff" ON public.staff
  FOR SELECT USING (true);

-- Service role can do everything
CREATE POLICY "Service role can manage staff" ON public.staff
  USING (true)
  WITH CHECK (true);
