ALTER TABLE public.music_lab_songs
  ADD COLUMN IF NOT EXISTS media_type text NOT NULL DEFAULT 'youtube',
  ADD COLUMN IF NOT EXISTS media_id text;

ALTER TABLE public.music_lab_songs
  DROP CONSTRAINT IF EXISTS music_lab_songs_media_type_check;
ALTER TABLE public.music_lab_songs
  ADD CONSTRAINT music_lab_songs_media_type_check CHECK (media_type IN ('youtube','spotify'));

UPDATE public.music_lab_songs
SET media_id = COALESCE(
      NULLIF(substring(youtube_url from '(?:v=|youtu\.be/|embed/|shorts/)([A-Za-z0-9_-]{6,})'), ''),
      NULLIF(substring(spotify_url from 'spotify\.com/track/([A-Za-z0-9]+)'), '')
    ),
    media_type = CASE
      WHEN youtube_url IS NOT NULL AND youtube_url <> '' THEN 'youtube'
      WHEN spotify_url IS NOT NULL AND spotify_url <> '' THEN 'spotify'
      ELSE media_type
    END
WHERE media_id IS NULL;