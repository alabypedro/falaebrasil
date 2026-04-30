DO $$
DECLARE
  q RECORD;
  current_count INT;
  i INT;
BEGIN
  FOR q IN SELECT id FROM public.quizzes LOOP
    SELECT count(*) INTO current_count FROM public.quiz_questions WHERE quiz_id = q.id;
    IF current_count < 10 THEN
      FOR i IN current_count..9 LOOP
        INSERT INTO public.quiz_questions (quiz_id, question_text, options, correct_option_index, display_order)
        VALUES (
          q.id,
          'Pergunta ' || (i + 1) || ' — edite no Admin',
          '["Opção A","Opção B","Opção C","Opção D"]'::jsonb,
          0,
          i
        );
      END LOOP;
    END IF;
  END LOOP;
END $$;