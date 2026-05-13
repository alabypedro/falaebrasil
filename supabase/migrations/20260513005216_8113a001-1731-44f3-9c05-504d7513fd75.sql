
-- Open all courses (and their lessons/videos) to any authenticated user
DROP POLICY IF EXISTS "Users view published A1 or admins view all" ON public.courses;
CREATE POLICY "Authenticated can view all courses"
ON public.courses
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Course-access users or admins can view lessons" ON public.lessons;
CREATE POLICY "Authenticated can view lessons"
ON public.lessons
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Course-access users or admins can view lesson videos" ON public.lesson_videos;
CREATE POLICY "Authenticated can view lesson videos"
ON public.lesson_videos
FOR SELECT
TO authenticated
USING (true);
