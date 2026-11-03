const config = require('./config');

// Sends one SMS. `to` is a 10 digit mobile number (or a short helpline number).
async function sendSms(to, text) {
  const provider = config.smsProvider;

  if (provider === 'console') {
    console.log(`[SMS to ${to}]\n${text}\n`);
    return;
  }

  if (provider === 'twilio') {
    if (!/^\d{10}$/.test(to)) throw new Error('Twilio cannot send SMS to short numbers like ' + to);
    const twilio = require('twilio')(config.twilioSid, config.twilioToken);
    await twilio.messages.create({ body: text.slice(0, 600), from: config.twilioFrom, to: '+91' + to });
    return;
  }

  // default: Fast2SMS (India)
  if (!/^\d{10}$/.test(to)) throw new Error('Fast2SMS cannot send SMS to short numbers like ' + to);
  await fast2sms({
    route: 'v3',
    sender_id: 'TXTIND',
    message: text.slice(0, 600),
    language: 'english',
    flash: 0,
    numbers: to,
  });
}

async function sendOtp(phone, otp) {
  const provider = config.smsProvider;

  if (provider === 'console') {
    console.log(`[OTP for ${phone}] ${otp}`);
    return;
  }
  if (provider === 'twilio') {
    return sendSms(phone, `Your SafeShield OTP is ${otp}. It is valid for 5 minutes.`);
  }
  await fast2sms({ route: 'otp', variables_values: otp, numbers: phone });
}

async function fast2sms(body) {
  const res = await fetch('https://www.fast2sms.com/dev/bulkV2', {
    method: 'POST',
    headers: { authorization: config.fast2smsKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  // Fast2SMS sometimes answers HTTP 200 with return:false when it fails
  if (!res.ok || data.return === false) {
    throw new Error(data.message ? [].concat(data.message).join(' ') : 'Fast2SMS error');
  }
}

module.exports = { sendSms, sendOtp };
