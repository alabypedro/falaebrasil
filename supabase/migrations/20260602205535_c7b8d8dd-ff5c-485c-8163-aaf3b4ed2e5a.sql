
DO $$
DECLARE
  r RECORD;
  theme TEXT;
  theme_lower TEXT;
  c JSONB;
BEGIN
  FOR r IN SELECT id, title FROM public.listening_lessons LOOP
    theme := regexp_replace(r.title, '^Lesson [0-9]+ - ', '');
    theme_lower := lower(theme);
    c := jsonb_build_object(
      'part1', jsonb_build_object(
        'image_url', 'https://source.unsplash.com/800x600/?' || replace(theme, ' ', ','),
        'correct_index', 0,
        'options', jsonb_build_array(
          jsonb_build_object('script', 'A person is discussing ' || theme_lower || ' in a business meeting.'),
          jsonb_build_object('script', 'Someone is preparing a meal in a restaurant kitchen.'),
          jsonb_build_object('script', 'A group of friends are playing music outdoors.')
        )
      ),
      'part2', jsonb_build_array(
        jsonb_build_object(
          'question_script', 'How often does your team work on ' || theme_lower || ' projects?',
          'correct_index', 0,
          'options', jsonb_build_array(
            jsonb_build_object('script', 'Almost every week.'),
            jsonb_build_object('script', 'I prefer tea, thank you.'),
            jsonb_build_object('script', 'It is near the park.')
          )
        ),
        jsonb_build_object(
          'question_script', 'What do you enjoy most about ' || theme_lower || '?',
          'correct_index', 0,
          'options', jsonb_build_array(
            jsonb_build_object('script', 'The chance to learn new things.'),
            jsonb_build_object('script', 'The weather is nice today.'),
            jsonb_build_object('script', 'My car is blue.')
          )
        ),
        jsonb_build_object(
          'question_script', 'Where did you first learn about ' || theme_lower || '?',
          'correct_index', 0,
          'options', jsonb_build_array(
            jsonb_build_object('script', 'At a conference last year.'),
            jsonb_build_object('script', 'I had pasta for dinner.'),
            jsonb_build_object('script', 'She is my sister.')
          )
        )
      ),
      'part3', jsonb_build_object(
        'dialogue', jsonb_build_array(
          jsonb_build_object('speaker','A','voice','male','text','I have been thinking about our ' || theme_lower || ' strategy lately.'),
          jsonb_build_object('speaker','B','voice','female','text','Really? What changes do you have in mind?'),
          jsonb_build_object('speaker','A','voice','male','text','We should focus more on customer experience and efficiency.'),
          jsonb_build_object('speaker','B','voice','female','text','I agree. Let''s schedule a meeting tomorrow to discuss it.')
        ),
        'questions', jsonb_build_array(
          jsonb_build_object('enunciado','What is the main topic of the conversation?','correct_index',0,
            'options', jsonb_build_array('A new ' || theme_lower || ' strategy.', 'A vacation plan.', 'A cooking recipe.')),
          jsonb_build_object('enunciado','What does speaker B suggest?','correct_index',0,
            'options', jsonb_build_array('Scheduling a meeting tomorrow.', 'Going to the beach.', 'Buying a new car.')),
          jsonb_build_object('enunciado','What should they focus on?','correct_index',0,
            'options', jsonb_build_array('Customer experience and efficiency.', 'Marketing posters only.', 'Hiring more interns.'))
        )
      ),
      'part4', jsonb_build_object(
        'script', 'In today''s global market, ' || theme || ' has become essential for sustainable growth. Companies that invest in proper training and modern technology often report significant gains in productivity. However, the human element remains the most important factor for long-term success, since motivated teams drive innovation and customer satisfaction every single day.',
        'questions', jsonb_build_array(
          jsonb_build_object('enunciado','What is the main topic?','correct_index',0,
            'options', jsonb_build_array('The importance of ' || theme || '.', 'A historical war.', 'A famous athlete.')),
          jsonb_build_object('enunciado','What do successful companies invest in?','correct_index',0,
            'options', jsonb_build_array('Training and modern technology.', 'Only office decoration.', 'Free lunches every day.')),
          jsonb_build_object('enunciado','What remains the most important factor?','correct_index',0,
            'options', jsonb_build_array('The human element.', 'The size of the office.', 'The brand color.'))
        )
      )
    );
    UPDATE public.listening_lessons SET content = c WHERE id = r.id;
  END LOOP;
END $$;
