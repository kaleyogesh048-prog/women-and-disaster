const crypto = require('crypto');
const config = require('./config');

// returns a clean 10 digit Indian mobile number, or null if it is not valid
function cleanPhone(p) {
  let d = String(p || '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  if (d.length === 11 && d[0] === '0') d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : null;
}

function sha(text) {
  return crypto.createHash('sha256').update(text + config.jwtSecret).digest('hex');
}

function mapsLink(lat, lng) {
  return `https://www.google.com/maps?q=${Number(lat).toFixed(6)},${Number(lng).toFixed(6)}`;
}

// user object without the password hash
function publicUser(u) {
  return { name: u.name, phone: u.phone, parentPhone: u.parentPhone || '' };
}

module.exports = { cleanPhone, sha, mapsLink, publicUser };
