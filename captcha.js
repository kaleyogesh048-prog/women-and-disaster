const crypto = require('crypto');
const store = require('./store');
const { HttpError } = require('./middleware');

// no 0/O/1/I so people do not mix them up
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const rand = n => crypto.randomInt(0, n);

function drawSvg(text) {
  let out = '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="56" viewBox="0 0 160 56">';
  out += '<rect width="160" height="56" fill="#fef2f2"/>';
  for (let i = 0; i < 5; i++) {
    out += `<line x1="${rand(160)}" y1="${rand(56)}" x2="${rand(160)}" y2="${rand(56)}" stroke="#fca5a5" stroke-width="2"/>`;
  }
  [...text].forEach((ch, i) => {
    const x = 18 + i * 28;
    const y = 36 + rand(8) - 4;
    const rot = rand(40) - 20;
    out += `<text x="${x}" y="${y}" font-size="30" font-weight="bold" font-family="monospace" fill="#991b1b" transform="rotate(${rot} ${x} ${y})">${ch}</text>`;
  });
  return out + '</svg>';
}

async function createCaptcha() {
  let text = '';
  for (let i = 0; i < 5; i++) text += LETTERS[rand(LETTERS.length)];
  const id = crypto.randomBytes(12).toString('hex');
  await store.set('captchas', id, { text, expiresAt: Date.now() + 5 * 60 * 1000 });
  return { id, svg: drawSvg(text) };
}

// a captcha can be used only once
async function checkCaptcha(id, typed) {
  const rec = id ? await store.get('captchas', String(id)) : null;
  if (rec) await store.remove('captchas', String(id));
  if (!rec || Date.now() > rec.expiresAt) throw new HttpError(400, 'Captcha expired, please try the new one');
  if (String(typed || '').trim().toUpperCase() !== rec.text) throw new HttpError(400, 'Captcha is wrong');
}

module.exports = { createCaptcha, checkCaptcha };
