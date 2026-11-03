const router = require('express').Router();
const store = require('../store');
const { HttpError, wrap, auth } = require('../middleware');
const { cleanPhone } = require('../utils');

const MAX_CONTACTS = 15;

router.use(auth);

function readBody(body) {
  const name = String(body.name || '').trim();
  const phone = cleanPhone(body.phone);
  if (!name) throw new HttpError(400, 'Please enter a name');
  if (!phone) throw new HttpError(400, 'Enter a valid 10 digit mobile number');
  return { name: name.slice(0, 40), phone };
}

// find a contact and make sure it belongs to this user
async function ownContact(req) {
  const c = await store.get('contacts', req.params.id);
  if (!c || c.ownerPhone !== req.phone) throw new HttpError(404, 'Contact not found');
  return c;
}

router.get('/', wrap(async (req, res) => {
  const list = await store.where('contacts', 'ownerPhone', req.phone);
  list.sort((a, b) => a.createdAt - b.createdAt);
  res.json({ success: true, contacts: list.map(({ id, name, phone }) => ({ id, name, phone })) });
}));

router.post('/', wrap(async (req, res) => {
  const { name, phone } = readBody(req.body);
  const list = await store.where('contacts', 'ownerPhone', req.phone);
  if (list.length >= MAX_CONTACTS) throw new HttpError(400, `You can add only ${MAX_CONTACTS} contacts`);
  if (list.some(c => c.phone === phone)) throw new HttpError(409, 'This number is already added');
  const id = await store.add('contacts', { ownerPhone: req.phone, name, phone, createdAt: Date.now() });
  res.json({ success: true, contact: { id, name, phone } });
}));

router.put('/:id', wrap(async (req, res) => {
  await ownContact(req);
  const { name, phone } = readBody(req.body);
  await store.merge('contacts', req.params.id, { name, phone });
  res.json({ success: true, contact: { id: req.params.id, name, phone } });
}));

router.delete('/:id', wrap(async (req, res) => {
  await ownContact(req);
  await store.remove('contacts', req.params.id);
  res.json({ success: true });
}));

module.exports = router;
