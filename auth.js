const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

const config = require('../config');
const store = require('../store');
const { sendOtp } = require('../sms');
const { createCaptcha, checkCaptcha } = require('../captcha');
const { HttpError, wrap } = require('../middleware');
const { cleanPhone, sha, publicUser } = require('../utils');

const OTP_MINUTES = 5;
const OTP_WAIT_SECONDS = 30;

// stops people from spamming OTP messages
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many OTP requests, try again after some time' },
});

function makeToken(phone) {
  return jwt.sign({ phone }, config.jwtSecret, { expiresIn: '30d' });
}

function needPhone(raw) {
  const phone = cleanPhone(raw);
  if (!phone) throw new HttpError(400, 'Enter a valid 10 digit mobile number');
  return phone;
}

function needPasswords(password, confirm) {
  if (!password || password.length < 6) throw new HttpError(400, 'Password must be at least 6 characters');
  if (password !== confirm) throw new HttpError(400, 'Password and confirm password are not same');
}

async function checkOtp(phone, purpose, otp) {
  const id = `${purpose}_${phone}`;
  const rec = await store.get('otps', id);
  if (!rec) throw new HttpError(400, 'Please ask for an OTP first');
  if (Date.now() > rec.expiresAt) {
    await store.remove('otps', id);
    throw new HttpError(400, 'OTP expired, ask for a new one');
  }
  if (rec.attempts >= 5) {
    await store.remove('otps', id);
    throw new HttpError(429, 'Too many wrong tries, ask for a new OTP');
  }
  if (rec.hash !== sha(String(otp || '').trim())) {
    await store.merge('otps', id, { attempts: rec.attempts + 1 });
    throw new HttpError(400, 'OTP is wrong');
  }
  await store.remove('otps', id); // one OTP, one use
}

router.get('/captcha', wrap(async (req, res) => {
  res.json({ success: true, ...(await createCaptcha()) });
}));

router.post('/send-otp', otpLimiter, wrap(async (req, res) => {
  const phone = needPhone(req.body.phone);
  const purpose = req.body.purpose;
  if (!['register', 'login', 'reset'].includes(purpose)) throw new HttpError(400, 'Wrong request');

  const user = await store.get('users', phone);
  if (purpose === 'register' && user) throw new HttpError(409, 'This number is already registered, please login');
  if (purpose !== 'register' && !user) throw new HttpError(404, 'This number is not registered, please register first');

  const id = `${purpose}_${phone}`;
  const old = await store.get('otps', id);
  if (old && Date.now() - old.sentAt < OTP_WAIT_SECONDS * 1000) {
    throw new HttpError(429, `Please wait ${OTP_WAIT_SECONDS} seconds before asking for another OTP`);
  }

  const otp = String(crypto.randomInt(100000, 1000000));
  await store.set('otps', id, {
    hash: sha(otp),
    attempts: 0,
    sentAt: Date.now(),
    expiresAt: Date.now() + OTP_MINUTES * 60 * 1000,
  });

  try {
    await sendOtp(phone, otp);
  } catch (e) {
    console.error('OTP send failed:', e.message);
    throw new HttpError(502, 'Could not send the OTP SMS. Please try again.');
  }

  res.json({ success: true, ...(config.devShowOtp ? { devOtp: otp } : {}) });
}));

router.post('/register', wrap(async (req, res) => {
  const { name, otp, password, confirmPassword, captchaId, captchaText } = req.body;
  const phone = needPhone(req.body.phone);

  if (!name || name.trim().length < 2) throw new HttpError(400, 'Please enter your full name');
  needPasswords(password, confirmPassword);
  await checkCaptcha(captchaId, captchaText);
  await checkOtp(phone, 'register', otp);

  if (await store.get('users', phone)) throw new HttpError(409, 'This number is already registered, please login');

  const user = {
    name: name.trim().slice(0, 60),
    phone,
    passwordHash: await bcrypt.hash(password, 10),
    parentPhone: '',
    createdAt: Date.now(),
  };
  await store.set('users', phone, user);
  res.json({ success: true, token: makeToken(phone), user: publicUser(user) });
}));

// login = mobile number + OTP (no name needed)
router.post('/login', wrap(async (req, res) => {
  const phone = needPhone(req.body.phone);
  const user = await store.get('users', phone);
  if (!user) throw new HttpError(404, 'This number is not registered, please register first');
  await checkOtp(phone, 'login', req.body.otp);
  res.json({ success: true, token: makeToken(phone), user: publicUser(user) });
}));

router.post('/reset-password', wrap(async (req, res) => {
  const phone = needPhone(req.body.phone);
  needPasswords(req.body.password, req.body.confirmPassword);
  if (!(await store.get('users', phone))) throw new HttpError(404, 'This number is not registered');
  await checkOtp(phone, 'reset', req.body.otp);
  await store.merge('users', phone, { passwordHash: await bcrypt.hash(req.body.password, 10) });
  res.json({ success: true });
}));

module.exports = router;
