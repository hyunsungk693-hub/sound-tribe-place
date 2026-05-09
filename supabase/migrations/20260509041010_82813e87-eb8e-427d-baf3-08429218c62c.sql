CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE public.room_reservations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id uuid NOT NULL,
  user_id uuid NOT NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT room_reservations_time_check CHECK (end_at > start_at),
  CONSTRAINT room_reservations_no_overlap EXCLUDE USING gist (
    room_id WITH =,
    tstzrange(start_at, end_at, '[)') WITH &&
  )
);

CREATE INDEX idx_room_reservations_room ON public.room_reservations(room_id, start_at);
CREATE INDEX idx_room_reservations_user ON public.room_reservations(user_id);

ALTER TABLE public.room_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read reservations"
  ON public.room_reservations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create own reservations"
  ON public.room_reservations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reservations"
  ON public.room_reservations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);