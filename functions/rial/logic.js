'use strict';
/**
 * Pure business logic for Rial-buying (TZS -> OMR) orders.
 * No Firebase or network code here, so it can be unit-tested directly.
 */
const crypto = require('crypto');

const ORDER_TTL_MINUTES = 15;

const STATUS = Object.freeze({
  PENDING_PAYMENT: 'PENDING_PAYMENT',     // waiting for the customer's TZS via ClickPesa
  PAID: 'PAID',                           // TZS confirmed by ClickPesa; waiting for OMR payout in Oman
  COMPLETED: 'COMPLETED',                 // OMR paid to the recipient, receipt uploaded
  EXPIRED: 'EXPIRED',                     // not paid within the rate-lock window
  FAILED: 'FAILED',                       // USSD push rejected/failed
});

const PAY_METHOD = Object.freeze({ USSD: 'USSD', CONTROL_NUMBER: 'CONTROL_NUMBER' });

/** After an order is PAID we keep watching the other channel this long, to catch a double payment. */
const EXTRA_PAYMENT_WATCH_MINUTES = 30;

/** ClickPesa only accepts alphanumeric references. Example: WOR261108K7Q2ZP */
function newOrderReference(now = new Date(), rand = crypto.randomBytes(6)) {
  const yy = String(now.getUTCFullYear()).slice(2);
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid confusion
  let suffix = '';
  for (let i = 0; i < 6; i++) suffix += alphabet[rand[i] % alphabet.length];
  return `WOR${yy}${mm}${dd}${suffix}`;
}

const MAX_USSD_PUSHES = 3;
const ORDER_REF_RE = /^WOR\d{6}[A-Z2-9]{6}$/;

/** Each USSD push needs its own unique reference: WOR...P1, WOR...P2 (alphanumeric only). */
function pushReference(orderRef, n) {
  return `${orderRef}P${n}`;
}

/** Map any reference ClickPesa sends back (order ref or push ref) to our order ref. */
function orderRefFromAny(ref) {
  if (typeof ref !== 'string') return null;
  if (ORDER_REF_RE.test(ref)) return ref;
  const m = /^(WOR\d{6}[A-Z2-9]{6})P\d{1,2}$/.exec(ref);
  return m ? m[1] : null;
}

/** Normalise a Tanzanian mobile number to 2557XXXXXXXX / 2556XXXXXXXX. Returns null if invalid. */
function normalizeTzPhone(input) {
  if (!input) return null;
  let d = String(input).replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0') && d.length === 10) d = '255' + d.slice(1);
  if (d.length === 9 && /^[67]/.test(d)) d = '255' + d;
  return /^255[67]\d{8}$/.test(d) ? d : null;
}

/**
 * Fee in TZS from tiers like [{ upToTzs: 500000, fee: 2000 }, { upToTzs: null, fee: 5000 }].
 * Tiers are matched in ascending order; `upToTzs: null` means "and above". Exempt => 0.
 */
function computeFee(tzsAmount, tiers, { exempt = false, feesEnabled = true } = {}) {
  if (exempt || !feesEnabled || !Array.isArray(tiers) || tiers.length === 0) return 0;
  const sorted = [...tiers].sort((a, b) => (a.upToTzs ?? Infinity) - (b.upToTzs ?? Infinity));
  for (const t of sorted) {
    if (t.upToTzs == null || tzsAmount <= t.upToTzs) return Math.max(0, Math.round(Number(t.fee) || 0));
  }
  return 0;
}

/**
 * Quote: OMR amount x rate (TZS per 1 OMR) + fee. The rate is read from the owner-only
 * settings document on the server; the client never sends a rate.
 */
function quote({ omrAmount, settings, exempt = false }) {
  const omr = Number(omrAmount);
  if (!Number.isFinite(omr) || omr <= 0) throw new Error('Kiasi cha Rial si sahihi');
  if (Math.round(omr * 1000) !== omr * 1000) throw new Error('Rial ina desimali 3 tu');
  const min = Number(settings.minOmr ?? 1);
  const max = Number(settings.maxOmr ?? 5000);
  if (omr < min) throw new Error(`Kiwango cha chini ni OMR ${min}`);
  if (omr > max) throw new Error(`Kiwango cha juu ni OMR ${max}`);
  const rate = Number(settings.tzsPerOmr);
  if (!Number.isFinite(rate) || rate <= 0) throw new Error('Rate haijawekwa');
  const tzsForOmr = Math.ceil(omr * rate);
  const fee = computeFee(tzsForOmr, settings.feeTiers, { exempt, feesEnabled: settings.feesEnabled !== false });
  return { omrAmount: omr, tzsPerOmr: rate, tzsForOmr, feeTzs: fee, totalTzs: tzsForOmr + fee };
}

function expiresAt(now = new Date(), minutes = ORDER_TTL_MINUTES) {
  return new Date(now.getTime() + minutes * 60 * 1000);
}

/**
 * Decide whether ClickPesa shows the order as paid.
 * - USSD: any payment attempt with status SUCCESS/SETTLED and collected amount >= expected.
 * - Control number (EXACT mode): remaining amount is 0.
 * Returns { paid, failed, payment }.
 */
function evaluateUssdPayments(payments, expectedTzs) {
  const list = Array.isArray(payments) ? payments : [];
  const ok = list.find((p) => ['SUCCESS', 'SETTLED'].includes(String(p.status).toUpperCase())
    && Number(p.collectedAmount ?? p.amount ?? 0) >= expectedTzs);
  if (ok) return { paid: true, failed: false, payment: ok };
  const allFailed = list.length > 0 && list.every((p) => String(p.status).toUpperCase() === 'FAILED');
  return { paid: false, failed: allFailed, payment: list[0] || null };
}

/** Sum of all successful USSD payments (used to detect money paid on more than one channel). */
function successfulUssdTotal(payments) {
  return (Array.isArray(payments) ? payments : [])
    .filter((p) => ['SUCCESS', 'SETTLED'].includes(String(p.status).toUpperCase()))
    .reduce((s, p) => s + Number(p.collectedAmount ?? p.amount ?? 0), 0);
}

/**
 * Combine both channels. Inputs:
 *   ussd:    [{ ref, payments: [...] }, ...]  (one entry per push sent)
 *   control: control-number details or null
 * Returns { paid, paidVia, payment, totalCollected, allUssdFailed }.
 */
function evaluateBothChannels({ ussd = [], control = null, expectedTzs }) {
  let paidVia = null;
  let payment = null;
  let totalCollected = 0;

  for (const u of ussd) {
    const r = evaluateUssdPayments(u.payments, expectedTzs);
    totalCollected += successfulUssdTotal(u.payments);
    if (r.paid && !paidVia) { paidVia = 'USSD'; payment = { ...r.payment, ref: u.ref }; }
  }
  const c = evaluateControlNumber(control, expectedTzs);
  if (c.paid) {
    totalCollected += Number(control.billAmount ?? expectedTzs);
    if (!paidVia) { paidVia = 'CONTROL_NUMBER'; payment = control; }
  }
  const allUssdFailed = ussd.length > 0 && ussd.every((u) => evaluateUssdPayments(u.payments, expectedTzs).failed);
  return { paid: Boolean(paidVia), paidVia, payment, totalCollected, allUssdFailed };
}

function evaluateControlNumber(details, expectedTzs) {
  if (!details) return { paid: false, failed: false, payment: null };
  const remaining = details.billRemainingAmount;
  const billAmount = Number(details.billAmount ?? expectedTzs);
  const paid = remaining != null && Number(remaining) <= 0 && billAmount >= expectedTzs;
  return { paid, failed: false, payment: paid ? details : null };
}

/** Pull every reference-looking field out of a webhook body (shape varies by event). */
function referencesFromWebhook(body) {
  const refs = new Set();
  const visit = (o, depth) => {
    if (!o || typeof o !== 'object' || depth > 4) return;
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === 'string' && /^(orderReference|billReference|billPayNumber|reference)$/i.test(k) && v) refs.add(v);
      else if (typeof v === 'object') visit(v, depth + 1);
    }
  };
  visit(body, 0);
  return [...refs];
}

module.exports = {
  ORDER_TTL_MINUTES, STATUS, PAY_METHOD, MAX_USSD_PUSHES, EXTRA_PAYMENT_WATCH_MINUTES,
  newOrderReference, pushReference, orderRefFromAny, normalizeTzPhone, computeFee, quote, expiresAt,
  evaluateUssdPayments, evaluateControlNumber, evaluateBothChannels, successfulUssdTotal, referencesFromWebhook,
};
