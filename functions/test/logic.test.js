'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../rial/logic');
const { createChecksum, verifyWebhook, canonicalize } = require('../clickpesa/checksum');
const { ClickPesaClient } = require('../clickpesa/client');

test('order reference is alphanumeric and dated', () => {
  const ref = L.newOrderReference(new Date(Date.UTC(2026, 10, 8)), Buffer.from([0, 1, 2, 3, 4, 5]));
  assert.match(ref, /^WOR261108[A-Z2-9]{6}$/);
  assert.match(L.newOrderReference(), /^[A-Z0-9]+$/);
});

test('Tanzanian phone normalisation', () => {
  assert.equal(L.normalizeTzPhone('0712 345 678'), '255712345678');
  assert.equal(L.normalizeTzPhone('+255 656 502 048'), '255656502048');
  assert.equal(L.normalizeTzPhone('712345678'), '255712345678');
  assert.equal(L.normalizeTzPhone('00255687000111'), '255687000111');
  assert.equal(L.normalizeTzPhone('0812345678'), null);
  assert.equal(L.normalizeTzPhone('+968 9123 4567'), null);
  assert.equal(L.normalizeTzPhone(''), null);
});

test('fee tiers, exemptions and switch', () => {
  const tiers = [{ upToTzs: 500000, fee: 2000 }, { upToTzs: 2000000, fee: 4000 }, { upToTzs: null, fee: 6000 }];
  assert.equal(L.computeFee(100000, tiers), 2000);
  assert.equal(L.computeFee(500000, tiers), 2000);
  assert.equal(L.computeFee(500001, tiers), 4000);
  assert.equal(L.computeFee(9000000, tiers), 6000);
  assert.equal(L.computeFee(9000000, tiers, { exempt: true }), 0);
  assert.equal(L.computeFee(9000000, tiers, { feesEnabled: false }), 0);
  assert.equal(L.computeFee(100, []), 0);
});

test('quote uses server rate and rounds TZS up', () => {
  const settings = { tzsPerOmr: 6700, minOmr: 5, maxOmr: 1000, feeTiers: [{ upToTzs: null, fee: 1500 }] };
  assert.deepEqual(L.quote({ omrAmount: 50, settings }), { omrAmount: 50, tzsPerOmr: 6700, tzsForOmr: 335000, feeTzs: 1500, totalTzs: 336500 });
  assert.equal(L.quote({ omrAmount: 10.125, settings }).tzsForOmr, 67838); // 67837.5 -> ceil
  assert.throws(() => L.quote({ omrAmount: 2, settings }), /chini/);
  assert.throws(() => L.quote({ omrAmount: 5000, settings }), /juu/);
  assert.throws(() => L.quote({ omrAmount: 10.1234, settings }), /desimali/);
  assert.throws(() => L.quote({ omrAmount: 10, settings: { minOmr: 1 } }), /Rate/);
});

test('USSD payment evaluation', () => {
  assert.equal(L.evaluateUssdPayments([{ status: 'SUCCESS', collectedAmount: '336500' }], 336500).paid, true);
  assert.equal(L.evaluateUssdPayments([{ status: 'SETTLED', collectedAmount: 336500 }], 336500).paid, true);
  assert.equal(L.evaluateUssdPayments([{ status: 'SUCCESS', collectedAmount: 1000 }], 336500).paid, false);
  assert.equal(L.evaluateUssdPayments([{ status: 'PROCESSING' }], 1).paid, false);
  assert.equal(L.evaluateUssdPayments([{ status: 'FAILED' }], 1).failed, true);
  assert.equal(L.evaluateUssdPayments([], 1).failed, false);
});

test('control number evaluation (EXACT mode)', () => {
  assert.equal(L.evaluateControlNumber({ billAmount: 336500, billRemainingAmount: 0 }, 336500).paid, true);
  assert.equal(L.evaluateControlNumber({ billAmount: 336500, billRemainingAmount: 336500 }, 336500).paid, false);
  assert.equal(L.evaluateControlNumber({ billAmount: 336500 }, 336500).paid, false);
  assert.equal(L.evaluateControlNumber(null, 1).paid, false);
});

test('push references map back to the order', () => {
  const o = 'WOR261108K7Q2ZP';
  assert.equal(L.pushReference(o, 2), 'WOR261108K7Q2ZPP2');
  assert.match(L.pushReference(o, 3), /^[A-Z0-9]+$/);
  assert.equal(L.orderRefFromAny(o), o);
  assert.equal(L.orderRefFromAny('WOR261108K7Q2ZPP1'), o);
  assert.equal(L.orderRefFromAny('55001234'), null);
  assert.equal(L.orderRefFromAny(undefined), null);
});

test('both channels: first paid wins, double payment is detected', () => {
  const expected = 336500;
  const ok = [{ status: 'SUCCESS', collectedAmount: 336500 }];
  const none = [{ status: 'PROCESSING' }];
  const cnPaid = { billAmount: 336500, billRemainingAmount: 0 };
  const cnOpen = { billAmount: 336500, billRemainingAmount: 336500 };

  let r = L.evaluateBothChannels({ ussd: [{ ref: 'P1', payments: ok }], control: cnOpen, expectedTzs: expected });
  assert.equal(r.paid, true); assert.equal(r.paidVia, 'USSD'); assert.equal(r.totalCollected, 336500); assert.equal(r.payment.ref, 'P1');

  r = L.evaluateBothChannels({ ussd: [{ ref: 'P1', payments: none }], control: cnPaid, expectedTzs: expected });
  assert.equal(r.paidVia, 'CONTROL_NUMBER'); assert.equal(r.totalCollected, 336500);

  r = L.evaluateBothChannels({ ussd: [{ ref: 'P1', payments: ok }], control: cnPaid, expectedTzs: expected });
  assert.equal(r.paid, true); assert.equal(r.totalCollected, 673000); // paid twice -> extra 336500 to amana

  r = L.evaluateBothChannels({ ussd: [], control: cnOpen, expectedTzs: expected });
  assert.equal(r.paid, false); assert.equal(r.totalCollected, 0);

  r = L.evaluateBothChannels({ ussd: [{ ref: 'P1', payments: [{ status: 'FAILED' }] }, { ref: 'P2', payments: [{ status: 'FAILED' }] }], control: null, expectedTzs: expected });
  assert.equal(r.paid, false); assert.equal(r.allUssdFailed, true);
});

test('webhook reference extraction handles nested shapes', () => {
  const body = { event: 'PAYMENT RECEIVED', data: { orderReference: 'WOR261108ABC234', billPayNumber: '55001234', customer: { customerName: 'A' } } };
  assert.deepEqual(L.referencesFromWebhook(body).sort(), ['55001234', 'WOR261108ABC234']);
  assert.deepEqual(L.referencesFromWebhook({}), []);
});

test('checksum canonicalises keys and verifies webhooks', () => {
  const key = 'secret-key';
  const a = createChecksum(key, { b: 1, a: { d: 2, c: [{ z: 1, y: 2 }] } });
  const b = createChecksum(key, { a: { c: [{ y: 2, z: 1 }], d: 2 }, b: 1 });
  assert.equal(a, b);
  assert.deepEqual(Object.keys(canonicalize({ b: 1, a: 2 })), ['a', 'b']);
  const body = { event: 'PAYMENT RECEIVED', data: { orderReference: 'X1', amount: '1000' } };
  const sig = createChecksum(key, body);
  assert.equal(verifyWebhook(key, body, sig), true);
  assert.equal(verifyWebhook(key, { ...body, checksum: sig }, undefined), true);
  assert.equal(verifyWebhook(key, body, 'bad'), false);
  assert.equal(verifyWebhook(key, { ...body, data: { ...body.data, amount: '9' } }, sig), false);
});

test('client: token caching, checksum injection and endpoints', async () => {
  const calls = [];
  const fakeFetch = async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith('/third-parties/generate-token')) {
      return { status: 200, ok: true, text: async () => JSON.stringify({ success: true, token: 'Bearer abc' }) };
    }
    return { status: 200, ok: true, text: async () => JSON.stringify({ id: 'T1', status: 'PROCESSING' }) };
  };
  const c = new ClickPesaClient({ clientId: 'id', apiKey: 'key', checksumKey: 'ck', env: 'sandbox', fetchImpl: fakeFetch });
  await c.initiateUssdPush({ amount: 336500, orderReference: 'WOR1', phoneNumber: '255712345678' });
  await c.createOrderControlNumber({ billReference: 'WOR2', amount: 1000, description: 'x' });
  assert.equal(calls.filter((x) => x.url.endsWith('generate-token')).length, 1); // token cached
  const push = calls[1];
  assert.equal(push.url, 'https://api-sandbox.clickpesa.com/third-parties/payments/initiate-ussd-push-request');
  assert.equal(push.init.headers.Authorization, 'Bearer abc');
  const sent = JSON.parse(push.init.body);
  const { checksum, ...rest } = sent;
  assert.equal(checksum, createChecksum('ck', rest));
  assert.equal(rest.amount, '336500');
  assert.equal(rest.currency, 'TZS');
  assert.equal(calls[2].url, 'https://api-sandbox.clickpesa.com/third-parties/billpay/create-order-control-number');
  assert.equal(JSON.parse(calls[2].init.body).billPaymentMode, 'EXACT');
});
