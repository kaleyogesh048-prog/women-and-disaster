const router = require('express').Router();
const config = require('../config');
const store = require('../store');
const HELPLINES = require('../helplines');
const { sendSms } = require('../sms');
const { HttpError, wrap, auth } = require('../middleware');
const { mapsLink } = require('../utils');

router.use(auth);

function buildMessage(type, user, loc) {
  const head = type === 'disaster'
    ? 'DISASTER ALERT! I am in a disaster situation and need help urgently.'
    : 'EMERGENCY! I feel unsafe and may be at risk. Please check my live location and contact me immediately.';
  let text = `${head}\n- ${user.name} (${user.phone})`;
  text += loc ? `\nLive location: ${mapsLink(loc.lat, loc.lng)}` : '\n(Location not available)';
  return text;
}

async function trySend(row, message) {
  try {
    await sendSms(row.phone, message);
    row.status = 'sent';
  } catch (e) {
    row.status = 'failed';
    row.error = e.message;
    console.error(`SOS SMS to ${row.phone} failed:`, e.message);
  }
}

/*
  Emergency -> parent + all saved contacts + helplines 181, 100, 1098
  Disaster  -> parent (linked number) + helplines 112, 108
  The parent always gets the message first.
*/
router.post('/', wrap(async (req, res) => {
  const type = req.body.type;
  if (type !== 'emergency' && type !== 'disaster') throw new HttpError(400, 'Alert type must be emergency or disaster');

  const user = await store.get('users', req.phone);
  if (!user) throw new HttpError(401, 'Account not found, please login again');
  if (!user.parentPhone) throw new HttpError(400, 'Please add your parent number first');

  const lat = Number(req.body.lat);
  const lng = Number(req.body.lng);
  const hasLocation = Number.isFinite(lat) && Number.isFinite(lng) && req.body.lat !== null && req.body.lng !== null
    && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  const loc = hasLocation ? { lat, lng } : null;
  const message = buildMessage(type, user, loc);

  // build the list of people to message (no duplicates)
  const rows = [];
  const seen = new Set();
  const add = (label, phone, role) => {
    if (seen.has(phone)) return;
    seen.add(phone);
    rows.push({ label, phone, role, status: 'sending' });
  };

  add('Parent', user.parentPhone, 'parent');
  if (type === 'emergency') {
    const contacts = await store.where('contacts', 'ownerPhone', user.phone);
    contacts.sort((a, b) => a.createdAt - b.createdAt);
    contacts.forEach(c => add(c.name, c.phone, 'contact'));
  }
  if (config.smsToHelplines) HELPLINES[type].forEach(n => add(n, n, 'helpline'));

  // parent first, then everybody else together
  await trySend(rows[0], message);
  await Promise.all(rows.slice(1).map(r => trySend(r, message)));

  await store.add('alerts', {
    ownerPhone: user.phone,
    type,
    message,
    location: loc,
    results: rows.map(r => ({ phone: r.phone, role: r.role, status: r.status })),
    createdAt: Date.now(),
  });

  res.json({
    success: true,
    type,
    message,
    mapsUrl: loc ? mapsLink(loc.lat, loc.lng) : '',
    results: rows,
  });
}));

module.exports = router;
