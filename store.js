// All database work goes through this one file.
// Normally it talks to Firebase Firestore. For quick testing you can set
// USE_MEMORY_DB=true and it keeps everything in memory instead.

function firestoreStore() {
  const admin = require('firebase-admin');

  let credential;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    credential = admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT));
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const path = require('path');
    credential = admin.credential.cert(require(path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH)));
  } else {
    credential = admin.credential.applicationDefault();
  }
  admin.initializeApp({ credential });
  const db = admin.firestore();

  return {
    async get(col, id) {
      const snap = await db.collection(col).doc(id).get();
      return snap.exists ? { id: snap.id, ...snap.data() } : null;
    },
    async set(col, id, data) {
      await db.collection(col).doc(id).set(data);
    },
    async merge(col, id, data) {
      await db.collection(col).doc(id).set(data, { merge: true });
    },
    async add(col, data) {
      const ref = await db.collection(col).add(data);
      return ref.id;
    },
    async remove(col, id) {
      await db.collection(col).doc(id).delete();
    },
    // all docs where field == value (we sort in code, so no Firestore index is needed)
    async where(col, field, value) {
      const snap = await db.collection(col).where(field, '==', value).get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },
    async removeWhere(col, field, value) {
      const snap = await db.collection(col).where(field, '==', value).get();
      const batch = db.batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    },
  };
}

function memoryStore() {
  const cols = {};
  const table = name => (cols[name] = cols[name] || new Map());
  let counter = 0;

  return {
    async get(col, id) {
      const v = table(col).get(id);
      return v ? { id, ...v } : null;
    },
    async set(col, id, data) {
      table(col).set(id, { ...data });
    },
    async merge(col, id, data) {
      table(col).set(id, { ...(table(col).get(id) || {}), ...data });
    },
    async add(col, data) {
      const id = 'm' + ++counter;
      table(col).set(id, { ...data });
      return id;
    },
    async remove(col, id) {
      table(col).delete(id);
    },
    async where(col, field, value) {
      return [...table(col).entries()].filter(([, v]) => v[field] === value).map(([id, v]) => ({ id, ...v }));
    },
    async removeWhere(col, field, value) {
      for (const [id, v] of table(col).entries()) if (v[field] === value) table(col).delete(id);
    },
  };
}

if (process.env.USE_MEMORY_DB === 'true') {
  console.log('Using in-memory database (testing only, data will be lost)');
  module.exports = memoryStore();
} else {
  module.exports = firestoreStore();
}
