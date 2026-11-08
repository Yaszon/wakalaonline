'use strict';
/**
 * WakalaOnline – Rial-buying orders (TZS -> OMR) paid ONLY through ClickPesa.
 *
 * Every order gets BOTH payment options at once:
 *   - an order control number (EXACT amount) the customer can pay from any bank or wallet, and
 *   - a USSD push (PIN prompt) when the customer gives a phone number; it can be re-sent.
 * Whichever is paid first marks the order PAID. If the customer pays on both channels,
 * the extra money is credited to the customer's deposit (amana).
 *
 * Exports (Firebase Functions v2, project "yaszone"):
 *   getRialQuote       callable  – price preview only
 *   createRialOrder    callable  – creates the order, control number and (optional) USSD push
 *   sendUssdPush       callable  – (re)sends the PIN prompt for a pending order
 *   clickpesaWebhook   https     – ClickPesa calls this when a payment changes
 *   pollRialOrders     schedule  – every 2 min: confirms payments, catches double payments, expires orders
 *   completeRialOrder  callable  – OWNER ONLY: marks OMR as paid in Oman
 *
 * Firestore:
 *   settings/rialRate      { tzsPerOmr, minOmr, maxOmr, feesEnabled, feeTiers[], feeExemptUids[], ownerUids[] }
 *   rialOrders/{orderRef}  one document per order
 *   amana/{uid}            { balanceTzs } extra money paid by a customer (deposit for the next order)
 *   ownerTasks/{id}        to-do list for the owner (PAY_OMR, EXTRA_PAYMENT)
 *
 * An order becomes PAID only after ClickPesa's own API confirms it (webhook bodies are never trusted alone).
 */
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineSecret, defineString } = require('firebase-functions/params');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');

const { ClickPesaClient } = require('../clickpesa/client');
const { verifyWebhook } = require('../clickpesa/checksum');
const L = require('./logic');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const { FieldValue, Timestamp } = admin.firestore;

const CLICKPESA_CLIENT_ID = defineSecret('CLICKPESA_CLIENT_ID');
const CLICKPESA_API_KEY = defineSecret('CLICKPESA_API_KEY');
const CLICKPESA_CHECKSUM_KEY = defineSecret('CLICKPESA_CHECKSUM_KEY');
const CLICKPESA_ENV = defineString('CLICKPESA_ENV', { default: 'sandbox' }); // 'sandbox' | 'production'
const SECRETS = [CLICKPESA_CLIENT_ID, CLICKPESA_API_KEY, CLICKPESA_CHECKSUM_KEY];
const REGION = 'europe-west1';

let _client;
function clickpesa() {
  if (!_client) {
    _client = new ClickPesaClient({
      clientId: CLICKPESA_CLIENT_ID.value(),
      apiKey: CLICKPESA_API_KEY.value(),
      checksumKey: CLICKPESA_CHECKSUM_KEY.value(),
      env: CLICKPESA_ENV.value(),
    });
  }
  return _client;
}

const orders = () => db.collection('rialOrders');
const fmt = (n) => Number(n).toLocaleString('en-US');

async function loadSettings() {
  const snap = await db.doc('settings/rialRate').get();
  if (!snap.exists) throw new HttpsError('failed-precondition', 'Rate haijawekwa bado');
  return snap.data();
}

function requireAuth(req) {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Ingia kwenye akaunti kwanza');
  return req.auth.uid;
}

async function requireOwner(req) {
  const uid = requireAuth(req);
  const s = await loadSettings();
  if (!Array.isArray(s.ownerUids) || !s.ownerUids.includes(uid)) throw new HttpsError('permission-denied', 'Huna ruhusa');
  return uid;
}

async function notify(order, title, body) {
  if (!order || !order.fcmToken) return;
  try {
    await admin.messaging().send({
      token: order.fcmToken,
      notification: { title, body },
      data: { orderRef: order.orderRef, status: order.status || '' },
    });
  } catch (e) {
    logger.warn('Push failed', { orderRef: order.orderRef, error: e.message });
  }
}

/** Sends one USSD push for an order and records it. Returns the push reference. */
async function startUssdPush(orderRef, order, phone) {
  const pushes = Array.isArray(order.ussdPushes) ? order.ussdPushes : [];
  if (pushes.length >= L.MAX_USSD_PUSHES) throw new HttpsError('resource-exhausted', 'Umefikia idadi ya juu ya maombi ya PIN. Tumia control number.');
  const ref = L.pushReference(orderRef, pushes.length + 1);
  const cp = clickpesa();
  let payerName = null;
  try {
    const preview = await cp.previewUssdPush({ amount: order.totalTzs, orderReference: ref, phoneNumber: phone });
    payerName = (preview && preview.sender && preview.sender.accountName) || null;
  } catch (e) {
    logger.warn('USSD preview failed, continuing', { ref, error: e.message });
  }
  const tx = await cp.initiateUssdPush({ amount: order.totalTzs, orderReference: ref, phoneNumber: phone });
  await orders().doc(orderRef).update({
    ussdPushes: FieldValue.arrayUnion({ ref, phone, transactionId: tx.id || null, sentAt: Timestamp.now() }),
    payerPhone: phone,
    ...(payerName ? { payerName } : {}),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { ref, payerName };
}

// ---------------------------------------------------------------------------
// getRialQuote
// ---------------------------------------------------------------------------
exports.getRialQuote = onCall({ region: REGION }, async (req) => {
  const uid = requireAuth(req);
  const s = await loadSettings();
  try {
    const exempt = Array.isArray(s.feeExemptUids) && s.feeExemptUids.includes(uid);
    return { ...L.quote({ omrAmount: req.data && req.data.omrAmount, settings: s, exempt }), validMinutes: L.ORDER_TTL_MINUTES };
  } catch (e) {
    throw new HttpsError('invalid-argument', e.message);
  }
});

// ---------------------------------------------------------------------------
// createRialOrder
// data: { omrAmount, recipient:{name, bank?, account}, payerPhone?, fcmToken? }
// Always creates a control number. If payerPhone is given, also sends a USSD push straight away.
// ---------------------------------------------------------------------------
exports.createRialOrder = onCall({ region: REGION, secrets: SECRETS }, async (req) => {
  const uid = requireAuth(req);
  const d = req.data || {};
  const s = await loadSettings();

  const recipient = d.recipient || {};
  if (!recipient.name || !recipient.account) throw new HttpsError('invalid-argument', 'Jaza jina na akaunti/namba ya mpokeaji Oman');

  let q;
  try {
    const exempt = Array.isArray(s.feeExemptUids) && s.feeExemptUids.includes(uid);
    q = L.quote({ omrAmount: d.omrAmount, settings: s, exempt });
  } catch (e) {
    throw new HttpsError('invalid-argument', e.message);
  }

  let payerPhone = null;
  if (d.payerPhone) {
    payerPhone = L.normalizeTzPhone(d.payerPhone);
    if (!payerPhone) throw new HttpsError('invalid-argument', 'Namba ya simu si sahihi (mfano 0712345678)');
  }

  const now = new Date();
  const orderRef = L.newOrderReference(now);
  const order = {
    orderRef,
    uid,
    status: L.STATUS.PENDING_PAYMENT,
    ...q,
    payerPhone,
    payerName: null,
    recipient: {
      name: String(recipient.name).slice(0, 120),
      bank: recipient.bank ? String(recipient.bank).slice(0, 80) : null,
      account: String(recipient.account).slice(0, 60),
    },
    fcmToken: d.fcmToken || null,
    ussdPushes: [],
    billPayNumber: null,
    createdAt: Timestamp.fromDate(now),
    expiresAt: Timestamp.fromDate(L.expiresAt(now)),
  };
  await orders().doc(orderRef).create(order);

  // 1. Control number – always.
  try {
    const cn = await clickpesa().createOrderControlNumber({
      billReference: orderRef,
      amount: q.totalTzs,
      description: `WakalaOnline OMR ${q.omrAmount}`,
      paymentMode: 'EXACT',
    });
    order.billPayNumber = cn.billPayNumber || null;
    await orders().doc(orderRef).update({ billPayNumber: order.billPayNumber });
  } catch (e) {
    logger.error('Control number failed', { orderRef, status: e.status, response: e.response, error: e.message });
  }

  // 2. USSD push – when a phone number was given.
  let push = null;
  if (payerPhone) {
    try {
      push = await startUssdPush(orderRef, order, payerPhone);
    } catch (e) {
      logger.error('USSD push failed', { orderRef, status: e.status, response: e.response, error: e.message });
    }
  }

  if (!order.billPayNumber && !push) {
    await orders().doc(orderRef).update({ status: L.STATUS.FAILED, failReason: 'ClickPesa haikupatikana', updatedAt: FieldValue.serverTimestamp() });
    throw new HttpsError('unavailable', 'Malipo hayakuweza kuanzishwa. Jaribu tena baadae.');
  }

  const lines = [];
  if (push) lines.push(`Angalia simu ${payerPhone.replace(/^255/, '0')} uweke PIN kulipa TZS ${fmt(q.totalTzs)}.`);
  if (order.billPayNumber) lines.push(`${push ? 'Au lipa' : 'Lipa'} TZS ${fmt(q.totalTzs)} kwenye control number ${order.billPayNumber} kutoka mtandao wowote au benki.`);
  lines.push(`Muda: dakika ${L.ORDER_TTL_MINUTES}.`);

  return {
    orderRef, ...q,
    billPayNumber: order.billPayNumber,
    ussdSent: Boolean(push),
    payerName: push ? push.payerName : null,
    expiresAt: order.expiresAt.toDate().toISOString(),
    message: lines.join(' '),
  };
});

// ---------------------------------------------------------------------------
// sendUssdPush – customer asks for the PIN prompt (again). data: { orderRef, payerPhone? }
// ---------------------------------------------------------------------------
exports.sendUssdPush = onCall({ region: REGION, secrets: SECRETS }, async (req) => {
  const uid = requireAuth(req);
  const { orderRef, payerPhone: rawPhone } = req.data || {};
  const snap = await orders().doc(String(orderRef || '')).get();
  if (!snap.exists || snap.data().uid !== uid) throw new HttpsError('not-found', 'Oda haipo');
  const order = snap.data();
  if (order.status !== L.STATUS.PENDING_PAYMENT) throw new HttpsError('failed-precondition', 'Oda hii haisubiri malipo tena');
  if (order.expiresAt.toMillis() < Date.now()) throw new HttpsError('deadline-exceeded', 'Oda imeisha muda. Weka oda mpya.');
  const phone = L.normalizeTzPhone(rawPhone || order.payerPhone);
  if (!phone) throw new HttpsError('invalid-argument', 'Weka namba sahihi ya simu');
  try {
    const push = await startUssdPush(orderRef, order, phone);
    return { ok: true, pushRef: push.ref, payerName: push.payerName, message: `Angalia simu ${phone.replace(/^255/, '0')} uweke PIN.` };
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    logger.error('Re-send USSD failed', { orderRef, error: e.message, response: e.response });
    throw new HttpsError('unavailable', 'Ombi la PIN halikutumwa. Tumia control number au jaribu tena.');
  }
});

// ---------------------------------------------------------------------------
// Read both channels from ClickPesa (the source of truth).
// ---------------------------------------------------------------------------
async function readChannels(order) {
  const cp = clickpesa();
  const ussd = [];
  for (const p of order.ussdPushes || []) {
    try { ussd.push({ ref: p.ref, payments: await cp.getPayments(p.ref) }); }
    catch (e) { if (e.status !== 404) logger.warn('USSD status read failed', { ref: p.ref, error: e.message }); ussd.push({ ref: p.ref, payments: [] }); }
  }
  let control = null;
  if (order.billPayNumber) {
    try { control = await cp.getControlNumber(order.billPayNumber); }
    catch (e) { logger.warn('Control number read failed', { bp: order.billPayNumber, error: e.message }); }
  }
  return L.evaluateBothChannels({ ussd, control, expectedTzs: order.totalTzs });
}

/** Confirms a pending order, and records double payments on already-paid orders. */
async function confirmOrder(orderRef) {
  const ref = orders().doc(orderRef);
  const snap = await ref.get();
  if (!snap.exists) return { found: false };
  const order = snap.data();
  const watchingExtra = [L.STATUS.PAID, L.STATUS.COMPLETED].includes(order.status) && order.paidAt
    && order.paidAt.toMillis() + L.EXTRA_PAYMENT_WATCH_MINUTES * 60 * 1000 > Date.now();
  if (order.status !== L.STATUS.PENDING_PAYMENT && !watchingExtra) return { found: true, status: order.status };

  const r = await readChannels(order);

  // --- Pending -> PAID ---
  if (order.status === L.STATUS.PENDING_PAYMENT) {
    if (!r.paid) return { found: true, status: order.status };
    let updated;
    await db.runTransaction(async (t) => {
      const cur = await t.get(ref);
      if (!cur.exists || cur.data().status !== L.STATUS.PENDING_PAYMENT) return;
      const p = r.payment || {};
      t.update(ref, {
        status: L.STATUS.PAID,
        paidAt: FieldValue.serverTimestamp(),
        paidVia: r.paidVia,
        payment: {
          id: p.id || null,
          ref: p.ref || order.billPayNumber || orderRef,
          status: p.status || 'PAID',
          channel: p.channel || null,
          collectedAmount: Number(p.collectedAmount ?? order.totalTzs),
          payerName: (p.customer && p.customer.customerName) || cur.data().payerName || null,
          payerPhone: (p.customer && p.customer.customerPhoneNumber) || null,
        },
        totalCollectedTzs: r.totalCollected,
        updatedAt: FieldValue.serverTimestamp(),
      });
      updated = { ...cur.data(), status: L.STATUS.PAID };
    });
    if (!updated) return { found: true, status: (await ref.get()).data().status };

    // Paid by USSD -> close the control number so it can't be paid as well.
    if (r.paidVia === 'USSD' && order.billPayNumber) {
      try { await clickpesa().setControlNumberStatus(order.billPayNumber, 'INACTIVE'); } catch (e) { logger.warn('Deactivate failed', { error: e.message }); }
    }
    await db.collection('ownerTasks').add({
      type: 'PAY_OMR', orderRef, omrAmount: updated.omrAmount, recipient: updated.recipient,
      createdAt: FieldValue.serverTimestamp(), done: false,
    });
    await notify(updated, 'Malipo yamepokelewa ✅', `Oda ${orderRef}: TZS ${fmt(updated.totalTzs)} imepokelewa. Rial itatumwa Oman.`);
    if (r.totalCollected > updated.totalTzs) await recordExtra(orderRef, updated, r.totalCollected);
    return { found: true, status: L.STATUS.PAID };
  }

  // --- Already paid: catch money paid on the second channel ---
  if (r.totalCollected > (order.totalCollectedTzs || order.totalTzs)) await recordExtra(orderRef, order, r.totalCollected);
  return { found: true, status: order.status };
}

/** Credits money paid above the order total to the customer's amana (once per new amount). */
async function recordExtra(orderRef, order, totalCollected) {
  const ref = orders().doc(orderRef);
  let credited = 0;
  await db.runTransaction(async (t) => {
    const cur = await t.get(ref);
    const already = Number(cur.data().extraCreditedTzs || 0);
    const extra = totalCollected - order.totalTzs - already;
    if (extra <= 0) return;
    t.update(ref, { extraCreditedTzs: already + extra, totalCollectedTzs: totalCollected, updatedAt: FieldValue.serverTimestamp() });
    t.set(db.collection('amana').doc(order.uid), { balanceTzs: FieldValue.increment(extra), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    credited = extra;
  });
  if (credited > 0) {
    await db.collection('ownerTasks').add({ type: 'EXTRA_PAYMENT', orderRef, uid: order.uid, extraTzs: credited, createdAt: FieldValue.serverTimestamp(), done: false });
    await notify(order, 'Malipo ya ziada', `Ulilipa TZS ${fmt(credited)} zaidi kwenye oda ${orderRef}. Zimewekwa kama amana yako kwa oda ijayo.`);
  }
}

// ---------------------------------------------------------------------------
// clickpesaWebhook – register this URL in the ClickPesa dashboard.
// ---------------------------------------------------------------------------
exports.clickpesaWebhook = onRequest({ region: REGION, secrets: SECRETS }, async (req, res) => {
  if (req.method !== 'POST') { res.status(405).send('Method not allowed'); return; }
  const body = req.body || {};
  if (!verifyWebhook(CLICKPESA_CHECKSUM_KEY.value(), body, req.get('X-ClickPesa-Signature'))) {
    logger.warn('Webhook signature did not verify; acting only on API-confirmed status', { body });
  }
  const refs = L.referencesFromWebhook(body);
  try {
    const done = new Set();
    for (const r of refs) {
      let orderRef = L.orderRefFromAny(r);
      if (!orderRef) {
        const q = await orders().where('billPayNumber', '==', r).limit(1).get();
        if (!q.empty) orderRef = q.docs[0].id;
      }
      if (orderRef && !done.has(orderRef)) { done.add(orderRef); await confirmOrder(orderRef); }
    }
    res.status(200).json({ received: true });
  } catch (e) {
    logger.error('Webhook processing failed', { error: e.message, refs });
    res.status(500).json({ received: false }); // ClickPesa retries; the poller is the backup.
  }
});

// ---------------------------------------------------------------------------
// pollRialOrders – backup for missed webhooks, double-payment watch, and expiry.
// ---------------------------------------------------------------------------
exports.pollRialOrders = onSchedule({ region: REGION, schedule: 'every 2 minutes', secrets: SECRETS }, async () => {
  const now = Date.now();

  const pending = await orders().where('status', '==', L.STATUS.PENDING_PAYMENT).limit(200).get();
  for (const doc of pending.docs) {
    const o = doc.data();
    try {
      const r = await confirmOrder(doc.id); // always check payment BEFORE expiring
      if (r.status !== L.STATUS.PENDING_PAYMENT) continue;
      if (o.expiresAt.toMillis() + 5 * 60 * 1000 < now) {
        if (o.billPayNumber) {
          try { await clickpesa().setControlNumberStatus(o.billPayNumber, 'INACTIVE'); } catch (e) { logger.warn('Deactivate failed', { error: e.message }); }
          if ((await confirmOrder(doc.id)).status !== L.STATUS.PENDING_PAYMENT) continue; // paid meanwhile
        }
        await doc.ref.update({ status: L.STATUS.EXPIRED, updatedAt: FieldValue.serverTimestamp() });
        await notify({ ...o, status: L.STATUS.EXPIRED }, 'Oda imeisha muda', `Oda ${doc.id} haikulipwa kwa wakati. Weka oda mpya kupata rate mpya.`);
      }
    } catch (e) {
      logger.error('Poll failed for order', { orderRef: doc.id, error: e.message });
    }
  }

  const since = Timestamp.fromMillis(now - L.EXTRA_PAYMENT_WATCH_MINUTES * 60 * 1000);
  const recent = await orders().where('paidAt', '>=', since).limit(200).get();
  for (const doc of recent.docs) {
    try { await confirmOrder(doc.id); } catch (e) { logger.error('Extra-payment check failed', { orderRef: doc.id, error: e.message }); }
  }
});

// ---------------------------------------------------------------------------
// completeRialOrder – OWNER ONLY. data: { orderRef, omrReceiptUrl?, omrReference? }
// ---------------------------------------------------------------------------
exports.completeRialOrder = onCall({ region: REGION }, async (req) => {
  const uid = await requireOwner(req);
  const { orderRef, omrReceiptUrl = null, omrReference = null } = req.data || {};
  if (!orderRef) throw new HttpsError('invalid-argument', 'orderRef inahitajika');
  const ref = orders().doc(orderRef);
  let order;
  await db.runTransaction(async (t) => {
    const s = await t.get(ref);
    if (!s.exists) throw new HttpsError('not-found', 'Oda haipo');
    if (s.data().status !== L.STATUS.PAID) throw new HttpsError('failed-precondition', `Oda iko ${s.data().status}, si PAID`);
    t.update(ref, { status: L.STATUS.COMPLETED, completedAt: FieldValue.serverTimestamp(), completedBy: uid,
      omrReceiptUrl, omrReference, updatedAt: FieldValue.serverTimestamp() });
    order = { ...s.data(), status: L.STATUS.COMPLETED };
  });
  const tasks = await db.collection('ownerTasks').where('orderRef', '==', orderRef).where('type', '==', 'PAY_OMR').where('done', '==', false).get();
  await Promise.all(tasks.docs.map((d) => d.ref.update({ done: true, doneAt: FieldValue.serverTimestamp() })));
  await notify(order, 'Rial imetumwa ✅', `Oda ${orderRef}: OMR ${order.omrAmount} imelipwa kwa ${order.recipient.name}.`);
  return { ok: true, status: L.STATUS.COMPLETED };
});

exports._confirmOrder = confirmOrder;
