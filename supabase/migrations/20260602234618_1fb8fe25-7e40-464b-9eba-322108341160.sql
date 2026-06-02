
DO $$
DECLARE
  r record;
  p jsonb;
  new_content jsonb;
  part1 jsonb;
  part2 jsonb;
  part3 jsonb;
  part4 jsonb;
  q jsonb;
  arr jsonb;
BEGIN
  FOR r IN SELECT id, content FROM public.listening_lessons WHERE content ? 'parts' LOOP
    part1 := NULL; part2 := NULL; part3 := NULL; part4 := NULL;
    FOR p IN SELECT * FROM jsonb_array_elements(r.content->'parts') LOOP
      IF (p->>'part_number')::int = 1 THEN
        arr := '[]'::jsonb;
        FOR q IN SELECT * FROM jsonb_array_elements(p->'options') LOOP
          arr := arr || jsonb_build_array(jsonb_build_object('script', q #>> '{}'));
        END LOOP;
        part1 := jsonb_build_object(
          'image_url', p->>'image_url',
          'options', arr,
          'correct_index', (p->>'correct_index')::int
        );
      ELSIF (p->>'part_number')::int = 2 THEN
        arr := '[]'::jsonb;
        FOR q IN SELECT * FROM jsonb_array_elements(p->'questions') LOOP
          arr := arr || jsonb_build_array(jsonb_build_object(
            'question_script', q->>'question',
            'options', (SELECT jsonb_agg(jsonb_build_object('script', o #>> '{}')) FROM jsonb_array_elements(q->'options') o),
            'correct_index', (q->>'correct_index')::int
          ));
        END LOOP;
        part2 := arr;
      ELSIF (p->>'part_number')::int = 3 THEN
        arr := '[]'::jsonb;
        FOR q IN SELECT * FROM jsonb_array_elements(p->'questions') LOOP
          arr := arr || jsonb_build_array(jsonb_build_object(
            'enunciado', q->>'question',
            'options', q->'options',
            'correct_index', (q->>'correct_index')::int
          ));
        END LOOP;
        part3 := jsonb_build_object(
          'dialogue', p->'dialogue',
          'questions', arr
        );
      ELSIF (p->>'part_number')::int = 4 THEN
        arr := '[]'::jsonb;
        FOR q IN SELECT * FROM jsonb_array_elements(p->'questions') LOOP
          arr := arr || jsonb_build_array(jsonb_build_object(
            'enunciado', q->>'question',
            'options', q->'options',
            'correct_index', (q->>'correct_index')::int
          ));
        END LOOP;
        part4 := jsonb_build_object(
          'script', p->>'text',
          'questions', arr
        );
      END IF;
    END LOOP;
    new_content := jsonb_build_object(
      'part1', part1,
      'part2', part2,
      'part3', part3,
      'part4', part4
    );
    UPDATE public.listening_lessons SET content = new_content WHERE id = r.id;
  END LOOP;
END $$;
