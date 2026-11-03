# SafeShield Backend

Node.js + Express API. Database is Firebase Firestore.

## What it does
- Register with OTP + captcha, login with mobile + OTP, forgot password
- Saves the parent (linked) number and extra contacts
- SOS: sends the alert SMS with the live location link
- AI assistant chat (messages are saved and can be deleted)

## 1. Run it
```
npm install
cp .env.example .env      # then open .env and fill it
npm start
```
The server starts on http://localhost:5000

Quick test without Firebase: put `USE_MEMORY_DB=true` in `.env`. Data is lost when the server stops, so use it only for testing.

## 2. Firebase Firestore setup
1. Go to https://console.firebase.google.com and create a project.
2. Build -> Firestore Database -> Create database.
3. Project settings -> Service accounts -> Generate new private key. A json file downloads.
4. Save it as `serviceAccountKey.json` in this folder (it is already in `.gitignore`, never upload it).
5. In `.env` keep `FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json`.

On Render / Railway you cannot upload a file, so paste the full json (one line) into the variable `FIREBASE_SERVICE_ACCOUNT` instead.

Collections created automatically: `users`, `contacts`, `aiMessages`, `alerts`, `otps`, `captchas`.
The backend uses the admin key, so keep your Firestore rules locked (`allow read, write: if false;`). The app never talks to Firestore directly.
Tip: in Firestore you can add a TTL policy on `expiresAt` for `otps` and `captchas` so old rows clean themselves.

## 3. SMS
Set `SMS_PROVIDER` in `.env`:
- `console` - only prints the SMS and OTP in the terminal (good for testing)
- `fast2sms` - needs `FAST2SMS_API_KEY`
- `twilio` - needs the three TWILIO values

With `DEV_SHOW_OTP=true` the OTP also comes back in the API reply and the app shows it on screen. Turn it off before going live.

## Alert rules
| Alert | Message goes to |
|---|---|
| Emergency | parent, then all saved contacts, then helplines 181, 100, 1098 |
| Disaster | parent (linked number), then helplines 112, 108 |

The numbers are in `src/helplines.js`.

Important: normal SMS gateways (Fast2SMS, Twilio) cannot deliver to short numbers like 100, 112, 108. Those rows will show as "failed" in the app. That is why the app also shows call buttons for the helplines. If you want to stop trying, set `SMS_TO_HELPLINES=false`.

## API list
| Method | Path | Use |
|---|---|---|
| GET | /api/health | check server |
| GET | /api/auth/captcha | new captcha (svg) |
| POST | /api/auth/send-otp | `{phone, purpose: register/login/reset}` |
| POST | /api/auth/register | name, phone, otp, password, confirmPassword, captchaId, captchaText |
| POST | /api/auth/login | phone, otp |
| POST | /api/auth/reset-password | phone, otp, password, confirmPassword |
| GET / PUT | /api/me | profile, change name or parentPhone |
| GET / POST | /api/contacts | list / add |
| PUT / DELETE | /api/contacts/:id | edit / delete |
| POST | /api/sos | `{type: emergency/disaster, lat, lng}` |
| GET / POST | /api/ai/messages, /api/ai/chat | chat history / ask |
| DELETE | /api/ai/messages/:id, /api/ai/messages | delete one / clear all |

All routes except auth and health need the header `Authorization: Bearer <token>`.

## Hosting
Any Node host works (Render, Railway). Set the same variables from `.env` in the host dashboard, and set `CORS_ORIGIN` to your frontend address.
