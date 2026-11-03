const router = require('express').Router();
const store = require('../store');
const { HttpError, wrap, auth } = require('../middleware');
const { cleanPhone, publicUser } = require('../utils');

router.use(auth);

async function currentUser(req) {
  const user = await store.get('users', req.phone);
  if (!user) throw new HttpError(401, 'Account not found, please login again');
  return user;
}

router.get('/', wrap(async (req, res) => {
  res.json({ success: true, user: publicUser(await currentUser(req)) });
}));

// change name and/or parent (linked) number
router.put('/', wrap(async (req, res) => {
  const user = await currentUser(req);
  const changes = {};

  if (req.body.name !== undefined) {
    const name = String(req.body.name).trim();
    if (name.length < 2) throw new HttpError(400, 'Please enter your full name');
    changes.name = name.slice(0, 60);
  }

  if (req.body.parentPhone !== undefined) {
    const parent = cleanPhone(req.body.parentPhone);
    if (!parent) throw new HttpError(400, 'Enter a valid 10 digit parent mobile number');
    if (parent === user.phone) throw new HttpError(400, 'Parent number cannot be your own number');
    changes.parentPhone = parent;
  }

  await store.merge('users', user.phone, changes);
  res.json({ success: true, user: publicUser({ ...user, ...changes }) });
}));

module.exports = router;
