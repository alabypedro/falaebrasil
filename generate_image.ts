import { createClient } from '@supabase/supabase-js';

const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;

async function generateImage(prompt: string) {
  const response = await fetch('https://api.lovable.dev/v1/images/generate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: "A realistic and high quality illustrative image of: " + prompt,
      n: 1,
      size: "1024x1024",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(\`Failed to generate image: \${errorText}\`);
  }

  const data = await response.json();
  return data.data[0].url;
}

const prompt = "The woman is handing her passport to the immigration officer at an airport counter.";
generateImage(prompt).then(url => console.log(JSON.stringify({url}))).catch(err => {
  console.error(err);
  process.exit(1);
});
