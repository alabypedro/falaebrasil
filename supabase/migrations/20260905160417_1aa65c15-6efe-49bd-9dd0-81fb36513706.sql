-- Access table
CREATE TABLE public.music_lab_access (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  source text NOT NULL DEFAULT 'admin',
  granted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.music_lab_access TO authenticated;
GRANT ALL ON public.music_lab_access TO service_role;
ALTER TABLE public.music_lab_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own music lab access"
  ON public.music_lab_access FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage music lab access"
  ON public.music_lab_access FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.has_music_lab_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin'::app_role)
     OR public.has_open_category(_user_id)
     OR EXISTS (SELECT 1 FROM public.music_lab_access a WHERE a.user_id = _user_id)
$$;

-- Songs
CREATE TABLE public.music_lab_songs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  artist text NOT NULL,
  level text NOT NULL DEFAULT 'A1',
  youtube_url text,
  spotify_url text,
  cover_url text,
  description text,
  active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.music_lab_songs TO authenticated;
GRANT ALL ON public.music_lab_songs TO service_role;
ALTER TABLE public.music_lab_songs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students with access can view songs"
  ON public.music_lab_songs FOR SELECT TO authenticated
  USING (active = true AND public.has_music_lab_access(auth.uid()));
CREATE POLICY "Admins manage songs"
  ON public.music_lab_songs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Blanks
CREATE TABLE public.music_lab_blanks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  song_id uuid NOT NULL REFERENCES public.music_lab_songs(id) ON DELETE CASCADE,
  line_index integer NOT NULL DEFAULT 0,
  text_before text NOT NULL DEFAULT '',
  answer text NOT NULL,
  text_after text NOT NULL DEFAULT '',
  hint text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.music_lab_blanks TO authenticated;
GRANT ALL ON public.music_lab_blanks TO service_role;
ALTER TABLE public.music_lab_blanks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students with access can view blanks"
  ON public.music_lab_blanks FOR SELECT TO authenticated
  USING (public.has_music_lab_access(auth.uid()));
CREATE POLICY "Admins manage blanks"
  ON public.music_lab_blanks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Vocabulary
CREATE TABLE public.music_lab_vocabulary (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  song_id uuid NOT NULL REFERENCES public.music_lab_songs(id) ON DELETE CASCADE,
  term text NOT NULL,
  kind text NOT NULL DEFAULT 'expression',
  explanation text NOT NULL,
  example text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.music_lab_vocabulary TO authenticated;
GRANT ALL ON public.music_lab_vocabulary TO service_role;
ALTER TABLE public.music_lab_vocabulary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students with access can view vocabulary"
  ON public.music_lab_vocabulary FOR SELECT TO authenticated
  USING (public.has_music_lab_access(auth.uid()));
CREATE POLICY "Admins manage vocabulary"
  ON public.music_lab_vocabulary FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER music_lab_songs_updated_at BEFORE UPDATE ON public.music_lab_songs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER music_lab_blanks_updated_at BEFORE UPDATE ON public.music_lab_blanks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER music_lab_vocabulary_updated_at BEFORE UPDATE ON public.music_lab_vocabulary
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER music_lab_access_updated_at BEFORE UPDATE ON public.music_lab_access
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_music_lab_blanks_song ON public.music_lab_blanks(song_id, line_index);
CREATE INDEX idx_music_lab_vocab_song ON public.music_lab_vocabulary(song_id, display_order);

-- Allow Music Lab XP
CREATE OR REPLACE FUNCTION public.award_ai_xp(_source text, _points integer, _key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _inserted_id uuid;
  _ai_total int;
  _profile_xp int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _source NOT IN ('memorizae','leiae','falae','escutae','escreveae','musiclab') THEN
    RAISE EXCEPTION 'Invalid source';
  END IF;
  IF _points IS NULL OR _points < 0 OR _points > 500 THEN
    RAISE EXCEPTION 'Invalid points';
  END IF;
  IF _key IS NULL OR length(_key) = 0 THEN RAISE EXCEPTION 'Invalid key'; END IF;

  INSERT INTO public.ai_xp_events(user_id, source, points, key)
  VALUES (_uid, _source, _points, _key)
  ON CONFLICT (user_id, key) DO NOTHING
  RETURNING id INTO _inserted_id;

  SELECT COALESCE(SUM(points),0) INTO _ai_total FROM public.ai_xp_events WHERE user_id = _uid;
  SELECT COALESCE(xp,0) INTO _profile_xp FROM public.profiles WHERE id = _uid;

  RETURN jsonb_build_object(
    'awarded', _inserted_id IS NOT NULL,
    'points', CASE WHEN _inserted_id IS NOT NULL THEN _points ELSE 0 END,
    'total_xp', _profile_xp + _ai_total
  );
END;
$function$;