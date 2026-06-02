const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;

async function generateImage(prompt) {
  const response = await fetch('https://api.lovable.dev/v1/ai/generate-image', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: "A realistic and high quality illustrative photo of: " + prompt,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error('Failed to generate image: ' + errorText);
  }

  const data = await response.json();
  return data.url;
}

const prompt = "The woman is handing her passport to the immigration officer at an airport counter.";
generateImage(prompt).then(url => console.log(JSON.stringify({url}))).catch(err => {
  console.error(err);
  process.exit(1);
});
