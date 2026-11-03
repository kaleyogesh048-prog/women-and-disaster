const router = require('express').Router();
const config = require('../config');
const store = require('../store');
const { HttpError, wrap, auth } = require('../middleware');

router.use(auth);

const SYSTEM_PROMPT =
  'You are the SafeShield assistant inside a personal-safety app used mostly in India (Maharashtra). ' +
  'Answer clearly and practically. For safety questions give short step-by-step advice. ' +
  'Only quote Indian helpline numbers you are sure about: 112 (emergency), 100 (police), 1091 and 181 (women), ' +
  '108 (ambulance), 1098 (child), 1930 (cyber crime). For legal questions give general information, not legal advice. ' +
  'If someone may be in immediate danger, tell them to press the SOS button or call 112 first. Keep answers under 180 words.';

const LANG_NAMES = { mr: 'Marathi', hi: 'Hindi', en: 'English' };

// used when no ANTHROPIC_API_KEY is set or the AI call fails
const FALLBACK = {
  en: 'I cannot give a detailed answer right now. If you are in danger, press the SOS button or call 112. Helplines: 112 (emergency), 100 (police), 181 / 1091 (women), 108 (ambulance), 1098 (child), 1930 (cyber crime).',
  mr: 'सध्या मी सविस्तर उत्तर देऊ शकत नाही. तुम्ही धोक्यात असाल तर SOS बटण दाबा किंवा 112 वर कॉल करा. हेल्पलाईन: 112 (आपत्कालीन), 100 (पोलीस), 181 / 1091 (महिला), 108 (रुग्णवाहिका), 1098 (चाईल्ड), 1930 (सायबर क्राईम).',
  hi: 'अभी मैं विस्तृत जवाब नहीं दे सकता। अगर आप खतरे में हैं तो SOS बटन दबाएं या 112 पर कॉल करें। हेल्पलाइन: 112 (आपातकालीन), 100 (पुलिस), 181 / 1091 (महिला), 108 (एम्बुलेंस), 1098 (चाइल्ड), 1930 (साइबर क्राइम)।',
};

async function askClaude(history, lang) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': config.anthropicKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: config.aiModel,
      max_tokens: 600,
      system: `${SYSTEM_PROMPT} Reply in ${LANG_NAMES[lang] || 'English'}.`,
      messages: history,
    }),
    signal: AbortSignal.timeout(20000),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
}

async function myMessages(phone) {
  const list = await store.where('aiMessages', 'ownerPhone', phone);
  list.sort((a, b) => a.createdAt - b.createdAt);
  return list;
}

const shape = m => ({ id: m.id, role: m.role, text: m.text, createdAt: m.createdAt });

router.get('/messages', wrap(async (req, res) => {
  res.json({ success: true, messages: (await myMessages(req.phone)).map(shape) });
}));

router.post('/chat', wrap(async (req, res) => {
  const text = String(req.body.text || '').trim().slice(0, 500);
  if (!text) throw new HttpError(400, 'Please type a question');
  const lang = LANG_NAMES[req.body.lang] ? req.body.lang : 'en';

  const userMsg = { ownerPhone: req.phone, role: 'user', text, createdAt: Date.now() };
  userMsg.id = await store.add('aiMessages', userMsg);

  // last 10 messages as context (must start with a user message)
  let history = (await myMessages(req.phone)).slice(-10).map(m => ({ role: m.role, content: m.text }));
  while (history.length && history[0].role !== 'user') history.shift();

  let reply = '';
  if (config.anthropicKey) {
    try {
      reply = await askClaude(history, lang);
    } catch (e) {
      console.error('AI error:', e.message);
    }
  }
  if (!reply) reply = FALLBACK[lang];

  const aiMsg = { ownerPhone: req.phone, role: 'assistant', text: reply, createdAt: Date.now() + 1 };
  aiMsg.id = await store.add('aiMessages', aiMsg);

  res.json({ success: true, messages: [shape(userMsg), shape(aiMsg)] });
}));

// delete one message
router.delete('/messages/:id', wrap(async (req, res) => {
  const m = await store.get('aiMessages', req.params.id);
  if (!m || m.ownerPhone !== req.phone) throw new HttpError(404, 'Message not found');
  await store.remove('aiMessages', req.params.id);
  res.json({ success: true });
}));

// clear the whole chat
router.delete('/messages', wrap(async (req, res) => {
  await store.removeWhere('aiMessages', 'ownerPhone', req.phone);
  res.json({ success: true });
}));

module.exports = router;
