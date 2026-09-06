-- Migration: Create staff_attendance table
-- Purpose: Historical attendance records for staff tracking

CREATE TABLE IF NOT EXISTS public.staff_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id INTEGER REFERENCES staff(id) NOT NULL,
  date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'present',  -- present/absent/on_leave/holiday
  check_in TIME,
  check_out TIME,
  notes TEXT,
  recorded_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(staff_id, date)
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_staff_attendance_date ON staff_attendance(date);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_staff ON staff_attendance(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_date_staff ON staff_attendance(date, staff_id);

-- Seed with current staff as "today's" attendance
INSERT INTO staff_attendance (staff_id, date, status, created_at)
SELECT id, CURRENT_DATE, 
  CASE 
    WHEN status = 'active' THEN 'present'
    WHEN status = 'on_leave' THEN 'on_leave'
    WHEN status = 'off_duty' THEN 'off_duty'
    ELSE 'absent'
  END,
  NOW()
FROM staff
WHERE outlet_id IN (200, 201)
ON CONFLICT (staff_id, date) DO NOTHING;

-- Show migration result
SELECT 'staff_attendance table created' as result;
SELECT COUNT(*) as attendance_records FROM staff_attendance;
