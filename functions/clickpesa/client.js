'use strict';
/**
 * Minimal ClickPesa API client (Node 18+, uses the built-in fetch).
 *
 * - Fetches a JWT from /third-parties/generate-token and caches it for 55 minutes.
 * - Adds an HMAC-SHA256 `checksum` to every POST/PUT/PATCH body when a checksum key is set.
 * - Retries transient 5xx / network errors with exponential backoff.
 *
 * Endpoints used (from ClickPesa's API):
 *   POST  /third-parties/payments/preview-ussd-push-request
 *   POST  /third-parties/payments/initiate-ussd-push-request
 *   GET   /third-parties/payments/{orderReference}
 *   POST  /third-parties/billpay/create-order-control-number
 *   GET   /third-parties/billpay/{billPayNumber}
 *   PATCH /third-parties/billpay/{billPayNumber}
 */
const { createChecksum } = require('./checksum');

const BASE_URLS = {
  sandbox: 'https://api-sandbox.clickpesa.com',
  production: 'https://api.clickpesa.com',
};
const TOKEN_TTL_MS = 55 * 60 * 1000;
const RETRY_STATUSES = new Set([500, 502, 503, 504]);

class ClickPesaError extends Error {
  constructor(message, status, response) {
    super(message);
    this.name = 'ClickPesaError';
    this.status = status;
    this.response = response;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class ClickPesaClient {
  /**
   * @param {{clientId:string, apiKey:string, checksumKey?:string, env?:'sandbox'|'production',
   *          fetchImpl?:Function, maxRetries?:number, timeoutMs?:number}} opts
   */
  constructor(opts) {
    if (!opts || !opts.clientId || !opts.apiKey) throw new Error('ClickPesa clientId and apiKey are required');
    this.clientId = opts.clientId;
    this.apiKey = opts.apiKey;
    this.checksumKey = opts.checksumKey || '';
    this.baseUrl = BASE_URLS[opts.env === 'production' ? 'production' : 'sandbox'];
    this.fetch = opts.fetchImpl || globalThis.fetch;
    this.maxRetries = opts.maxRetries || 3;
    this.timeoutMs = opts.timeoutMs || 30000;
    this._token = null;
    this._tokenExpiresAt = 0;
  }

  async _raw(method, path, { headers = {}, body } = {}) {
    let lastErr;
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), this.timeoutMs);
      try {
        const res = await this.fetch(this.baseUrl + path, {
          method,
          headers: { 'Content-Type': 'application/json', ...headers },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: ctrl.signal,
        });
        clearTimeout(t);
        const text = await res.text();
        let data;
        try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
        if (RETRY_STATUSES.has(res.status) && attempt < this.maxRetries) {
          await sleep(500 * 2 ** (attempt - 1));
          continue;
        }
        return { status: res.status, ok: res.ok, data };
      } catch (err) {
        clearTimeout(t);
        lastErr = err;
        if (attempt < this.maxRetries) { await sleep(500 * 2 ** (attempt - 1)); continue; }
      }
    }
    throw new ClickPesaError(`Network error calling ClickPesa: ${lastErr && lastErr.message}`, 0, null);
  }

  async _token_() {
    if (this._token && Date.now() < this._tokenExpiresAt) return this._token;
    const res = await this._raw('POST', '/third-parties/generate-token', {
      headers: { 'client-id': this.clientId, 'api-key': this.apiKey },
    });
    if (!res.ok || !res.data || !res.data.token) {
      throw new ClickPesaError((res.data && res.data.message) || `ClickPesa auth failed (${res.status})`, res.status, res.data);
    }
    // The API returns "Bearer <jwt>"; keep it exactly as returned.
    this._token = res.data.token;
    this._tokenExpiresAt = Date.now() + TOKEN_TTL_MS;
    return this._token;
  }

  async request(method, path, body) {
    const token = await this._token_();
    let payload = body;
    if (payload && this.checksumKey && ['POST', 'PUT', 'PATCH'].includes(method)) {
      payload = { ...payload, checksum: createChecksum(this.checksumKey, payload) };
    }
    let res = await this._raw(method, path, { headers: { Authorization: token }, body: payload });
    if (res.status === 401) {
      // Token may have been revoked early: refresh once and retry.
      this._token = null;
      const fresh = await this._token_();
      res = await this._raw(method, path, { headers: { Authorization: fresh }, body: payload });
    }
    if (!res.ok) {
      throw new ClickPesaError((res.data && res.data.message) || `ClickPesa error ${res.status}`, res.status, res.data);
    }
    return res.data;
  }

  // ---- Collections: USSD push ----
  previewUssdPush({ amount, orderReference, phoneNumber, fetchSenderDetails = true }) {
    const body = { amount: String(amount), currency: 'TZS', orderReference, fetchSenderDetails };
    if (phoneNumber) body.phoneNumber = phoneNumber;
    return this.request('POST', '/third-parties/payments/preview-ussd-push-request', body);
  }

  initiateUssdPush({ amount, orderReference, phoneNumber }) {
    return this.request('POST', '/third-parties/payments/initiate-ussd-push-request', {
      amount: String(amount), phoneNumber, currency: 'TZS', orderReference,
    });
  }

  /** Returns an array of payment attempts for this order reference. */
  async getPayments(orderReference) {
    const data = await this.request('GET', `/third-parties/payments/${encodeURIComponent(orderReference)}`);
    return Array.isArray(data) ? data : (data && Array.isArray(data.data) ? data.data : []);
  }

  // ---- Collections: BillPay order control number ----
  createOrderControlNumber({ billReference, amount, description, paymentMode = 'EXACT' }) {
    return this.request('POST', '/third-parties/billpay/create-order-control-number', {
      billReference, billAmount: amount, billDescription: description, billPaymentMode: paymentMode,
    });
  }

  getControlNumber(billPayNumber) {
    return this.request('GET', `/third-parties/billpay/${encodeURIComponent(billPayNumber)}`);
  }

  setControlNumberStatus(billPayNumber, status /* 'ACTIVE' | 'INACTIVE' */) {
    return this.request('PATCH', `/third-parties/billpay/${encodeURIComponent(billPayNumber)}`, { billStatus: status });
  }
}

module.exports = { ClickPesaClient, ClickPesaError, BASE_URLS };
