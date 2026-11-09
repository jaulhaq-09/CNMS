const Groq = require('groq-sdk');

let groq = null;
function getClient() {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not set. Add it to backend/.env — get a free key at console.groq.com.');
  }
  if (!groq) {
    groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return groq;
}

const MODEL = 'llama-3.3-70b-versatile';

function buildNewsletterPrompt(events, { tone = 'formal', departmentName } = {}) {
  const eventLines = events
    .map(
      (e, i) =>
        `${i + 1}. "${e.title}" — ${e.eventDate}${e.clusterName ? ` (${e.clusterName}` : ''}${
          e.sectionName ? `, ${e.sectionName})` : e.clusterName ? ')' : ''
        }\n   ${e.description || 'No description provided.'}`
    )
    .join('\n\n');

  const system = `You are a professional college newsletter editor. Write clean, well-structured HTML
(using only <h1>, <h2>, <p>, <ul>, <li>, <strong>, <em> — no external CSS or scripts) suitable for
an email newsletter body. Do not invent facts not present in the event list provided.`;

  const user = `Write a newsletter${departmentName ? ` for the ${departmentName} department` : ''} covering
these events, in a ${tone} tone:

${eventLines}

Return your response as valid JSON with exactly these keys: "subject" (a short email subject line),
"bodyHtml" (the HTML newsletter body), and "bodyText" (a plain-text version of the same content).
Return ONLY the JSON object, no markdown code fences, no commentary.`;

  return { system, user };
}

async function generateNewsletterDraft(events, options = {}) {
  if (!events || events.length === 0) {
    throw new Error('At least one event is required to generate a newsletter.');
  }

  const { system, user } = buildNewsletterPrompt(events, options);

  const completion = await getClient().chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.6,
    response_format: { type: 'json_object' },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error('Empty response from AI provider.');

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error('AI returned malformed JSON.');
  }

  if (!parsed.subject || !parsed.bodyHtml) {
    throw new Error('AI response is missing required fields.');
  }

  return parsed;
}

async function summarizeEvent(description) {
  const completion = await getClient().chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: 'Summarize the following college event description in 2 sentences, plain text only.' },
      { role: 'user', content: description },
    ],
    temperature: 0.4,
  });
  return completion.choices[0]?.message?.content?.trim() || '';
}

module.exports = { generateNewsletterDraft, summarizeEvent };