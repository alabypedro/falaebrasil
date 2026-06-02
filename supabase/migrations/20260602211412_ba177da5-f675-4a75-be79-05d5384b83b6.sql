-- Clear existing listening lessons
DELETE FROM public.listening_lessons;

-- Create a temporary function to generate content to avoid massive SQL file
CREATE OR REPLACE FUNCTION generate_listening_content(p_level TEXT, p_unit_num INTEGER)
RETURNS JSONB AS $$
DECLARE
    v_theme TEXT;
    v_content JSONB;
BEGIN
    -- Determine theme based on level and unit
    IF p_level = 'A1' THEN
        v_theme := CASE p_unit_num 
            WHEN 1 THEN 'Greetings and Introductions'
            WHEN 2 THEN 'Daily Routines'
            WHEN 3 THEN 'At the Office'
            WHEN 4 THEN 'Shopping'
            WHEN 5 THEN 'Food and Restaurants'
            WHEN 6 THEN 'Travel Basics'
            WHEN 7 THEN 'Holidays'
            WHEN 8 THEN 'Directions'
            WHEN 9 THEN 'Work Experience'
            WHEN 10 THEN 'Personal Information'
            WHEN 11 THEN 'Family'
            WHEN 12 THEN 'Hobbies'
            ELSE 'General English' END;
    ELSIF p_level = 'A2' THEN
        v_theme := CASE p_unit_num 
            WHEN 1 THEN 'Job Interviews'
            WHEN 2 THEN 'Business Meetings'
            WHEN 3 THEN 'Telephoning'
            WHEN 4 THEN 'Customer Service'
            WHEN 5 THEN 'Project Management'
            WHEN 6 THEN 'Socializing at Work'
            WHEN 7 THEN 'Health and Safety'
            WHEN 8 THEN 'Marketing Basics'
            WHEN 9 THEN 'Finance and Money'
            WHEN 10 THEN 'IT and Technology'
            WHEN 11 THEN 'Environment'
            WHEN 12 THEN 'Future Plans'
            ELSE 'Workplace Communications' END;
    ELSIF p_level = 'B1' THEN
        v_theme := CASE p_unit_num 
            WHEN 1 THEN 'Negotiating'
            WHEN 2 THEN 'Presentations'
            WHEN 3 THEN 'Leadership'
            WHEN 4 THEN 'Corporate Culture'
            WHEN 5 THEN 'International Trade'
            WHEN 6 THEN 'Quality Management'
            WHEN 7 THEN 'Brand Identity'
            WHEN 8 THEN 'Risk Management'
            WHEN 9 THEN 'Ethics at Work'
            WHEN 10 THEN 'Innovation'
            ELSE 'Professional Development' END;
    END IF;

    v_content := jsonb_build_object(
        'part1', jsonb_build_object(
            'image_url', 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1000&auto=format&fit=crop',
            'options', jsonb_build_array(
                jsonb_build_object('script', 'They are having a meeting in the conference room.'),
                jsonb_build_object('script', 'He is working alone at his desk.'),
                jsonb_build_object('script', 'The building is being painted.')
            ),
            'correct_index', 0
        ),
        'part2', jsonb_build_array(
            jsonb_build_object(
                'question_script', 'Where is the main office located?',
                'options', jsonb_build_array(
                    jsonb_build_object('script', 'It''s in the city center.'),
                    jsonb_build_object('script', 'At three o''clock.'),
                    jsonb_build_object('script', 'Yes, it is very big.')
                ),
                'correct_index', 0
            ),
            jsonb_build_object(
                'question_script', 'When is the project deadline?',
                'options', jsonb_build_array(
                    jsonb_build_object('script', 'To the manager.'),
                    jsonb_build_object('script', 'Next Friday at noon.'),
                    jsonb_build_object('script', 'In the meeting room.')
                ),
                'correct_index', 1
            ),
            jsonb_build_object(
                'question_script', 'How did you get to the airport?',
                'options', jsonb_build_array(
                    jsonb_build_object('script', 'I took a taxi.'),
                    jsonb_build_object('script', 'For two hours.'),
                    jsonb_build_object('script', 'It was very expensive.')
                ),
                'correct_index', 0
            )
        ),
        'part3', jsonb_build_object(
            'dialogue', jsonb_build_array(
                jsonb_build_object('speaker', 'female', 'text', 'Good morning, Mr. Smith. Do you have a moment to discuss the quarterly report?'),
                jsonb_build_object('speaker', 'male', 'text', 'Morning, Sarah. Yes, I just finished my coffee. What''s on your mind?'),
                jsonb_build_object('speaker', 'female', 'text', 'The sales figures for our new product are much higher than expected.'),
                jsonb_build_object('speaker', 'male', 'text', 'That''s great news! Let''s schedule a meeting with the whole team tomorrow.')
            ),
            'questions', jsonb_build_array(
                jsonb_build_object('enunciado', 'What does Sarah want to discuss?', 'options', jsonb_build_array('The quarterly report', 'Coffee prices', 'A new employee'), 'correct_index', 0),
                jsonb_build_object('enunciado', 'How are the sales figures?', 'options', jsonb_build_array('Lower than expected', 'Higher than expected', 'The same as last year'), 'correct_index', 1),
                jsonb_build_object('enunciado', 'When will the team meeting take place?', 'options', jsonb_build_array('Today', 'Tomorrow', 'Next week'), 'correct_index', 1)
            )
        ),
        'part4', jsonb_build_object(
            'script', 'Welcome to our annual technology conference. Today we will explore the latest trends in artificial intelligence and how they are transforming the global business landscape. Please silence your mobile phones and feel free to ask questions after the presentation.',
            'questions', jsonb_build_array(
                jsonb_build_object('enunciado', 'What is the main topic of the conference?', 'options', jsonb_build_array('Mobile phone history', 'Artificial intelligence in business', 'Global traveling'), 'correct_index', 1),
                jsonb_build_object('enunciado', 'What are participants asked to do?', 'options', jsonb_build_array('Turn on their phones', 'Silence their phones', 'Leave the room'), 'correct_index', 1),
                jsonb_build_object('enunciado', 'When can participants ask questions?', 'options', jsonb_build_array('During the talk', 'After the presentation', 'Before the conference starts'), 'correct_index', 1)
            )
        )
    );
    
    RETURN v_content;
END;
$$ LANGUAGE plpgsql;

-- Insert A1 Lessons (12 units)
INSERT INTO public.listening_lessons (title, description, level, content)
SELECT 
    'Unit ' || LPAD(i::text, 2, '0') || ' - ' || (CASE i 
        WHEN 1 THEN 'Greetings and Introductions'
        WHEN 2 THEN 'Daily Routines'
        WHEN 3 THEN 'At the Office'
        WHEN 4 THEN 'Shopping'
        WHEN 5 THEN 'Food and Restaurants'
        WHEN 6 THEN 'Travel Basics'
        WHEN 7 THEN 'Holidays'
        WHEN 8 THEN 'Directions'
        WHEN 9 THEN 'Work Experience'
        WHEN 10 THEN 'Personal Information'
        WHEN 11 THEN 'Family'
        WHEN 12 THEN 'Hobbies'
        END),
    'Practice basic English listening skills for ' || p_level || ' level.',
    p_level,
    generate_listening_content(p_level, i)
FROM generate_series(1, 12) AS i, LATERAL (SELECT 'A1' as p_level) AS p;

-- Insert A2 Lessons (12 units)
INSERT INTO public.listening_lessons (title, description, level, content)
SELECT 
    'Unit ' || LPAD(i::text, 2, '0') || ' - ' || (CASE i 
        WHEN 1 THEN 'Job Interviews'
        WHEN 2 THEN 'Business Meetings'
        WHEN 3 THEN 'Telephoning'
        WHEN 4 THEN 'Customer Service'
        WHEN 5 THEN 'Project Management'
        WHEN 6 THEN 'Socializing at Work'
        WHEN 7 THEN 'Health and Safety'
        WHEN 8 THEN 'Marketing Basics'
        WHEN 9 THEN 'Finance and Money'
        WHEN 10 THEN 'IT and Technology'
        WHEN 11 THEN 'Environment'
        WHEN 12 THEN 'Future Plans'
        END),
    'Practice intermediate English listening skills for ' || p_level || ' level.',
    p_level,
    generate_listening_content(p_level, i)
FROM generate_series(1, 12) AS i, LATERAL (SELECT 'A2' as p_level) AS p;

-- Insert B1 Lessons (10 units)
INSERT INTO public.listening_lessons (title, description, level, content)
SELECT 
    'Unit ' || LPAD(i::text, 2, '0') || ' - ' || (CASE i 
        WHEN 1 THEN 'Negotiating'
        WHEN 2 THEN 'Presentations'
        WHEN 3 THEN 'Leadership'
        WHEN 4 THEN 'Corporate Culture'
        WHEN 5 THEN 'International Trade'
        WHEN 6 THEN 'Quality Management'
        WHEN 7 THEN 'Brand Identity'
        WHEN 8 THEN 'Risk Management'
        WHEN 9 THEN 'Ethics at Work'
        WHEN 10 THEN 'Innovation'
        END),
    'Practice advanced-intermediate English listening skills for ' || p_level || ' level.',
    p_level,
    generate_listening_content(p_level, i)
FROM generate_series(1, 10) AS i, LATERAL (SELECT 'B1' as p_level) AS p;

-- Cleanup temporary function
DROP FUNCTION generate_listening_content(TEXT, INTEGER);
