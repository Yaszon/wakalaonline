'use strict';
/**
 * Quick check against the ClickPesa SANDBOX with your real sandbox keys (no Firebase needed).
 *
 *   CLICKPESA_CLIENT_ID=... CLICKPESA_API_KEY=... CLICKPESA_CHECKSUM_KEY=... \
 *   node scripts/sandbox-check.js 255712345678 1000
 *
 * 1. Gets a token, 2. previews a USSD push (shows the wallet name), 3. creates an order control number.
 */
const { ClickPesaClient } = require('../clickpesa/client');
const { newOrderReference, normalizeTzPhone } = require('../rial/logic');

(async () => {
  const phone = normalizeTzPhone(process.argv[2] || '');
  const amount = Number(process.argv[3] || 1000);
  if (!phone) { console.error('Weka namba ya simu, mfano: node scripts/sandbox-check.js 0712345678 1000'); process.exit(1); }
  const c = new ClickPesaClient({
    clientId: process.env.CLICKPESA_CLIENT_ID,
    apiKey: process.env.CLICKPESA_API_KEY,
    checksumKey: process.env.CLICKPESA_CHECKSUM_KEY,
    env: process.env.CLICKPESA_ENV || 'sandbox',
  });
  const ref1 = newOrderReference();
  console.log('Preview USSD push', ref1);
  console.log(JSON.stringify(await c.previewUssdPush({ amount, orderReference: ref1, phoneNumber: phone }), null, 2));
  const ref2 = newOrderReference();
  console.log('Create order control number', ref2);
  console.log(JSON.stringify(await c.createOrderControlNumber({ billReference: ref2, amount, description: 'Sandbox test' }), null, 2));
})().catch((e) => { console.error('FAILED:', e.message, e.status, JSON.stringify(e.response)); process.exit(1); });
