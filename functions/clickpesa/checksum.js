'use strict';
/**
 * ClickPesa HMAC-SHA256 checksum.
 *
 * Algorithm (same as ClickPesa's own SDKs):
 *   1. Sort every object's keys alphabetically, at every nesting level.
 *   2. Serialise to compact JSON (no spaces).
 *   3. hex( HMAC-SHA256(checksumKey, json) )
 *
 * The payload must NOT contain the `checksum` / `checksumMethod` fields themselves.
 */
const crypto = require('crypto');

function canonicalize(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  const out = {};
  for (const key of Object.keys(value).sort()) out[key] = canonicalize(value[key]);
  return out;
}

function createChecksum(checksumKey, payload) {
  if (!checksumKey) return '';
  const json = JSON.stringify(canonicalize(payload));
  return crypto.createHmac('sha256', checksumKey).update(json, 'utf8').digest('hex');
}

/**
 * Verify a webhook. ClickPesa sends the signature in the `X-ClickPesa-Signature`
 * header (some payloads also carry a `checksum` field in the body). We strip the
 * checksum fields from the body before computing, and compare in constant time.
 */
function verifyWebhook(checksumKey, body, headerSignature) {
  if (!checksumKey || !body || typeof body !== 'object') return false;
  const { checksum: bodyChecksum, checksumMethod, ...rest } = body; // eslint-disable-line no-unused-vars
  const signature = headerSignature || bodyChecksum;
  if (!signature || typeof signature !== 'string') return false;
  const expected = createChecksum(checksumKey, rest);
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { canonicalize, createChecksum, verifyWebhook };
