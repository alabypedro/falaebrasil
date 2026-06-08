UPDATE listening_lessons
SET content = jsonb_set(content, '{part1}', (content->'part1') - 'image_url')
WHERE content ? 'part1' AND (content->'part1') ? 'image_url';