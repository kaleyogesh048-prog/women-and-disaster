require('dotenv').config();

const env = process.env;

module.exports = {
  port: env.PORT || 5000,
  jwtSecret: env.JWT_SECRET || 'change-this-secret',
  corsOrigin: env.CORS_ORIGIN || '*',

  smsProvider: (env.SMS_PROVIDER || 'console').toLowerCase(),
  fast2smsKey: env.FAST2SMS_API_KEY || '',
  twilioSid: env.TWILIO_ACCOUNT_SID || '',
  twilioToken: env.TWILIO_AUTH_TOKEN || '',
  twilioFrom: env.TWILIO_PHONE_NUMBER || '',
  smsToHelplines: env.SMS_TO_HELPLINES !== 'false',
  devShowOtp: env.DEV_SHOW_OTP === 'true',

  anthropicKey: env.ANTHROPIC_API_KEY || '',
  aiModel: env.AI_MODEL || 'claude-sonnet-5-5',
};
