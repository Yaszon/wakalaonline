/* WakalaOnline App — app ya wateja. Inazungumza na seva (Apps Script /exec) kwa vitendo vya "w_". */
(function () {
  'use strict';
  var HELP_WA = '96897232813';                      // WhatsApp ya biashara (msaada)
  var $ = function (id) { return document.getElementById(id); };
  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  var S = { wt: LS.get('yzw_t', ''), me: LS.get('yzw_me', null), orders: LS.get('yzw_orders', []), info: LS.get('yzw_info', null),
            rec: null, kind: 'mobile', proof: '', stack: [], cur: null, filt: 'all', poll: 0 };

  /* ---------- seva ---------- */
  function server() { return String(window.YZ_SERVER || '').trim(); }
  function api(action, body) {
    var url = server();
    if (!url) return Promise.reject(new Error('Seva haijawekwa kwenye app'));
    var payload = Object.assign({ action: action }, body || {}); if (S.wt) payload.wt = S.wt;
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload), redirect: 'follow' })
      .then(function (r) { return r.text(); })
      .then(function (t) {
        var j; try { j = JSON.parse(t); } catch (e) { throw new Error('Seva haikujibu vizuri. Jaribu tena'); }
        if (j && j.error === 'login') { logout(true); throw new Error('Ingia tena'); }
        return j;
      }, function () { throw new Error('Hakuna mtandao. Angalia intaneti yako'); });
  }

  /* ---------- msaada ---------- */
  var nf = new Intl.NumberFormat('en-US');
  function tzs(n) { return nf.format(Math.round(Number(n) || 0)); }
  function omr(n) { n = Number(n) || 0; return n.toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 3 : 0, maximumFractionDigits: 3 }); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function when(t) {
    if (!t) return ''; var d = new Date(t), now = new Date(), hm = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    if (d.toDateString() === now.toDateString()) return 'Leo ' + hm;
    var y = new Date(now); y.setDate(now.getDate() - 1); if (d.toDateString() === y.toDateString()) return 'Jana ' + hm;
    var M = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ago', 'Sep', 'Okt', 'Nov', 'Des'];
    return d.getDate() + ' ' + M[d.getMonth()] + ' · ' + hm;
  }
  function toast(m) { var t = $('toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('on'); }, 2800); }
  function busy(btn, on, label) {
    if (on) { btn._l = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spin" aria-hidden="true"></span>' + (label || 'Subiri…'); }
    else { btn.disabled = false; if (btn._l) btn.innerHTML = btn._l; }
  }
  function info() { return (S.me && S.me.info) || S.info || null; }
  function rateFor(o) { var i = info(); if (!i) return 0; var r = (i.rateBig && i.bigMin && o >= i.bigMin) ? i.rateBig : i.rate; return Math.max(r || 0, Number(i.vip) || 0); }
  function initials(n) { n = String(n || '').trim(); return n ? n.charAt(0).toUpperCase() : '?'; }
  function firstName(n) { var s = String(n || '').trim().split(/\s+/)[0] || ''; return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(); }
  var ICON = {
    home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
    hist: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>',
    acct: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    check: '<path d="m5 12 5 5 9-10"/>'
  };
  function svg(name, size, color, sw) { return '<svg aria-hidden="true" width="' + (size || 22) + '" height="' + (size || 22) + '" viewBox="0 0 24 24" fill="none" stroke="' + (color || 'currentColor') + '" stroke-width="' + (sw || 1.8) + '" stroke-linecap="round" stroke-linejoin="round">' + ICON[name] + '</svg>'; }

  /* ---------- skrini ---------- */
  function show(id, push) {
    document.querySelectorAll('.scr').forEach(function (s) { s.classList.toggle('on', s.id === 's-' + id); });
    if (push !== false && S.stack[S.stack.length - 1] !== id) S.stack.push(id);
    window.scrollTo(0, 0);
    clearInterval(S.poll); S.poll = 0;
    if (id === 'home') drawHome();
    if (id === 'hist') drawHist();
    if (id === 'acct') drawAcct();
    if (id === 'track') { drawTrack(); S.poll = setInterval(function () { loadOrders().then(drawTrack); }, 20000); }
    if (history.state !== id) try { history.pushState(id, ''); } catch (e) {}
  }
  function back() {
    S.stack.pop(); var prev = S.stack[S.stack.length - 1] || (S.wt ? 'home' : 'login');
    show(prev, false);
  }
  window.addEventListener('popstate', function () { if (S.stack.length > 1) back(); });
  document.addEventListener('backbutton', function () { if (S.stack.length > 1) back(); }, false);
  document.querySelectorAll('[data-back]').forEach(function (b) { b.onclick = back; });
  document.querySelectorAll('nav.tabs').forEach(function (n) {
    var on = n.getAttribute('data-tab');
    var tabs = [['home', 'Nyumbani', 'home'], ['send', 'Tuma', 'send'], ['hist', 'Historia', 'hist'], ['acct', 'Akaunti', 'acct']];
    n.innerHTML = tabs.map(function (t) { return '<button data-go="' + t[0] + '" class="' + (t[0] === on ? 'on' : '') + '"' + (t[0] === on ? ' aria-current="page"' : '') + '>' + svg(t[2]) + t[1] + '</button>'; }).join('');
    n.onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return; var go = b.getAttribute('data-go');
      if (go === 'send') return openSend(null);
      S.stack = [go]; show(go, false);
    };
  });

  /* ---------- kuingia ---------- */
  var lgPhone = '', resendT = 0;
  function buildOtp() {
    var box = $('otp'); box.innerHTML = '';
    for (var i = 0; i < 6; i++) {
      var inp = document.createElement('input'); inp.inputMode = 'numeric'; inp.autocomplete = i === 0 ? 'one-time-code' : 'off';
      inp.setAttribute('aria-label', 'Tarakimu ' + (i + 1)); box.appendChild(inp);
    }
    var ins = box.querySelectorAll('input');
    ins.forEach(function (inp, i) {
      inp.addEventListener('input', function () {
        var v = inp.value.replace(/\D/g, '');
        if (v.length > 1) { v.split('').slice(0, 6 - i).forEach(function (c, k) { ins[i + k].value = c; }); ins[Math.min(5, i + v.length - 1)].focus(); }
        else { inp.value = v; if (v && i < 5) ins[i + 1].focus(); }
        if (otpVal().length === 6) verify();
      });
      inp.addEventListener('keydown', function (e) { if (e.key === 'Backspace' && !inp.value && i > 0) ins[i - 1].focus(); });
    });
  }
  function otpVal() { return Array.prototype.map.call($('otp').querySelectorAll('input'), function (x) { return x.value; }).join(''); }
  function resendTick(sec) {
    clearInterval(resendT); var left = sec || 45, b = $('lgResend');
    var f = function () { if (left <= 0) { clearInterval(resendT); b.disabled = false; b.textContent = 'Tuma tena'; return; } b.disabled = true; b.textContent = 'Tuma tena (0:' + ('0' + left).slice(-2) + ')'; left--; };
    f(); resendT = setInterval(f, 1000);
  }
  function sendCode(btn) {
    var raw = $('lgPhone').value.replace(/\D/g, '').replace(/^0+/, ''), cc = $('lgCc').value;
    $('lgErr1').textContent = '';
    if (raw.length < 7) { $('lgErr1').textContent = 'Weka namba yako ya WhatsApp'; return; }
    var phone = raw.indexOf(cc) === 0 && raw.length > 9 ? raw : cc + raw;
    busy(btn, true, 'Inatuma…');
    api('w_code', { phone: phone }).then(function (j) {
      busy(btn, false);
      if (!j.ok) { $('lgErr1').textContent = j.msg || 'Imeshindikana'; $('lgErr2').textContent = j.msg || ''; if (j.wait) resendTick(j.wait); return; }
      lgPhone = j.phone; $('lgTo').textContent = '+' + j.phone; LS.set('yzw_lastphone', { cc: cc, raw: raw });
      $('lg1').style.display = 'none'; $('lg2').style.display = 'flex'; $('lgErr2').textContent = '';
      buildOtp(); resendTick(j.wait || 45); setTimeout(function () { var f = $('otp').querySelector('input'); f && f.focus(); }, 50);
    }).catch(function (e) { busy(btn, false); $('lgErr1').textContent = e.message; });
  }
  function verify() {
    var code = otpVal(), btn = $('lgGo'); $('lgErr2').textContent = '';
    if (code.length !== 6) { $('lgErr2').textContent = 'Weka tarakimu zote 6'; return; }
    if (btn.disabled) return;
    busy(btn, true, 'Inaingia…');
    api('w_verify', { phone: lgPhone, code: code, v: Number(window.YZ_VER) || 0 }).then(function (j) {
      busy(btn, false);
      if (!j.ok) { $('lgErr2').textContent = j.msg || 'Code si sahihi'; if (j.error === 'expired') buildOtp(); return; }
      S.wt = j.wt; LS.set('yzw_t', j.wt); delete j.wt; setMe(j);
      S.stack = ['home']; show('home', false); loadOrders().then(drawHome); LS.del('yzw_push'); setTimeout(pushInit, 1200);
      if (!j.name) setTimeout(function () { toast('Karibu! Weka jina lako kwenye Akaunti'); }, 600);
    }).catch(function (e) { busy(btn, false); $('lgErr2').textContent = e.message; });
  }
  $('lgSend').onclick = function () { sendCode(this); };
  $('lgPhone').addEventListener('keydown', function (e) { if (e.key === 'Enter') sendCode($('lgSend')); });
  $('lgResend').onclick = function () { sendCode(this); };
  $('lgBack').onclick = function () { $('lg2').style.display = 'none'; $('lg1').style.display = 'flex'; clearInterval(resendT); };
  $('lgGo').onclick = verify;
  function logout(silent) {
    S.wt = ''; S.me = null; S.orders = []; pushReady = false; ['yzw_t', 'yzw_me', 'yzw_orders', 'yzw_push'].forEach(LS.del);
    S.stack = ['login']; show('login', false); if (!silent) toast('Umetoka');
  }

  /* ---------- data ---------- */
  function setMe(j) { S.me = j; LS.set('yzw_me', j); if (j.info) { S.info = j.info; LS.set('yzw_info', j.info); } checkUpdate(); }
  /* toleo jipya la app: seva inajua toleo jipya (GitHub Actions inalituma kila build); app inamwonyesha mteja */
  var upShown = false;
  function checkUpdate() {
    var i = (S.me && S.me.info) || S.info || {}, mine = Number(window.YZ_VER) || 0, nv = Number(i.appVer) || 0;
    var has = mine > 0 && nv > mine && !!i.appUrl;
    var bar = $('upBar'); if (bar) bar.style.display = has ? 'flex' : 'none';
    if (!has || upShown) return;
    var skip = LS.get('yzw_upskip', null); if (skip && skip.v === nv && Date.now() - skip.at < 864e5) return;
    upShown = true; showUpdate();
  }
  function showUpdate() {
    var i = (S.me && S.me.info) || S.info || {};
    $('upTxt').innerHTML = 'Toleo <b>1.' + (Number(i.appVer) || '') + '</b> liko tayari (wewe una 1.' + (Number(window.YZ_VER) || '') + '). Pakua upate maboresho mapya.';
    $('upNotes').style.display = i.appNotes ? 'block' : 'none'; $('upNotes').textContent = i.appNotes ? '✨ ' + i.appNotes : '';
    $('up').classList.add('on');
  }
  $('upGo').onclick = function () { var i = (S.me && S.me.info) || S.info || {}; if (i.appUrl) window.open(i.appUrl, '_blank'); toast('Inapakua… fungua faili likiisha'); };
  $('upLater').onclick = function () { var i = (S.me && S.me.info) || S.info || {}; LS.set('yzw_upskip', { v: Number(i.appVer) || 0, at: Date.now() }); $('up').classList.remove('on'); };
  $('upBar').onclick = showUpdate;
  function loadMe() { return api('w_me', { v: Number(window.YZ_VER) || 0 }).then(function (j) { if (j.ok) setMe(j); return j; }).catch(function () {}); }
  function loadOrders() { return api('w_orders').then(function (j) { if (j.ok) { S.orders = j.orders || []; LS.set('yzw_orders', S.orders); } return j; }).catch(function () {}); }
  function loadInfo() { return api('w_info').then(function (j) { if (j.ok) { S.info = j; LS.set('yzw_info', j); if (S.me) { S.me.info = Object.assign({}, S.me.info, j); } checkUpdate(); } return j; }).catch(function () {}); }

  /* ---------- nyumbani ---------- */
  function drawHome() {
    var me = S.me || {}, i = info();
    var h = new Date().getHours();
    $('hGreet').textContent = h < 5 ? 'Habari za usiku' : h < 12 ? 'Habari za asubuhi' : h < 16 ? 'Habari za mchana' : h < 20 ? 'Habari za jioni' : 'Habari za usiku';   // saa ya simu ya mteja
    $('hName').textContent = me.name ? firstName(me.name) : 'Karibu WakalaOnline';
    $('hAv').textContent = initials(me.name || 'W');
    if (i && i.rate) $('hRate').textContent = tzs(rateFor(0));
    $('hVip').style.display = i && i.vip && i.vip > i.rate ? 'inline-flex' : 'none';
    $('hRateAt').textContent = i && i.at ? 'Saa ' + new Date(i.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
    if (i && i.rateBig && i.bigMin && i.rateBig > rateFor(0)) { $('hBig').style.display = 'block'; $('hBig').innerHTML = 'Ukituma ' + omr(i.bigMin) + ' OMR au zaidi: <b style="color:var(--lime)">' + tzs(i.rateBig) + ' TZS</b>'; }
    else $('hBig').style.display = 'none';
    calc();
    var rec = (me.recipients || []).slice(0, 6);
    $('hRecWrap').style.display = rec.length ? 'flex' : 'none';
    $('hRec').innerHTML = '<button class="rec" data-r="new" aria-label="Ongeza mpokeaji"><span class="av add">+</span><span class="mut">Mpya</span></button>'
      + rec.map(function (r, k) { return '<button class="rec" data-r="' + k + '"><span class="av">' + esc(initials(r.rn)) + '</span><span>' + esc(firstName(r.rn)) + '</span></button>'; }).join('');
    drawRefCard(); drawDebt(); drawNews();
    var sb = Math.abs(Number(me.bal) || 0) > 0.0005 || !!me.canAmana; $('hBalBtn').style.display = sb ? '' : 'none';
    $('hBalBtn').parentNode.style.gridTemplateColumns = sb ? '' : 'repeat(3,minmax(0,1fr))';
    var act = S.orders.filter(function (o) { return o.st === 'new' || o.st === 'ok' || o.st === 'hold' || o.st === 'part'; }).slice(0, 3);
    $('hActive').innerHTML = act.map(function (o) {
      return '<button class="card" data-ref="' + esc(o.ref) + '" style="width:100%;text-align:left;cursor:pointer;display:flex;flex-direction:column;gap:12px;color:var(--ink)">'
        + '<div class="row" style="justify-content:space-between"><span class="row" style="gap:10px;min-width:0"><span class="avs">' + esc(initials(o.rn)) + '</span><span style="display:flex;flex-direction:column;min-width:0"><span style="font-weight:800;font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(o.rn || 'Order') + '</span><span class="mut" style="font-size:12px;font-weight:600">Oda inayoendelea · ' + esc(o.ref) + '</span></span></span>' + pill(o) + '</div>'
        + '<div class="num" style="font-size:18px;font-weight:700">' + tzs(o.tzs) + ' <span style="font-size:13px;color:var(--mut)">TZS</span></div>'
        + '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px">' + [1, 2, 3].map(function (s) { return '<div style="height:6px;border-radius:3px;background:' + (o.step >= s ? 'var(--ok)' : 'var(--line)') + '"></div>'; }).join('') + '</div></button>';
    }).join('');
  }
  function calc() {
    var o = Number(String($('cOmr').value).replace(/,/g, '')) || 0, r = rateFor(o);
    $('cTzs').textContent = r ? tzs(o * r) : '—';
    $('cRateTxt').textContent = r ? '1 OMR = ' + tzs(r) : '';
    chipsOn('cChips', o);
  }
  function chipsOn(id, v) { document.querySelectorAll('#' + id + ' button').forEach(function (b) { b.classList.toggle('on', Number(b.getAttribute('data-amt')) === Number(v)); }); }
  function haptic() { try { navigator.vibrate && navigator.vibrate(8); } catch (e) {} }
  document.addEventListener('click', function (e) { if (e.target.closest('.btn,.qa button,nav.tabs button,.chips button,.rec')) haptic(); });
  $('cChips').onclick = function (e) { var b = e.target.closest('[data-amt]'); if (!b) return; $('cOmr').value = b.getAttribute('data-amt'); calc(); };
  $('qaHist').onclick = function () { S.stack = ['hist']; show('hist', false); };
  $('qaHelp').onclick = function () { window.open('https://wa.me/' + HELP_WA, '_blank'); };
  (function () {   // vuta chini kusasisha
    var y0 = null, d = 0, ptr = $('ptr');
    document.addEventListener('touchstart', function (e) { var on = document.querySelector('.scr.on'); y0 = (on && on.id === 's-home' && window.scrollY <= 0) ? e.touches[0].clientY : null; d = 0; }, { passive: true });
    document.addEventListener('touchmove', function (e) { if (y0 == null) return; d = Math.max(0, e.touches[0].clientY - y0); ptr.style.height = Math.min(56, d / 2.2) + 'px'; }, { passive: true });
    document.addEventListener('touchend', function () {
      if (y0 == null) return; y0 = null;
      if (d > 110) { ptr.style.height = '44px'; haptic(); Promise.all([loadMe(), loadOrders(), loadInfo()]).then(function () { ptr.style.height = '0'; drawHome(); toast('Imesasishwa'); }); }
      else ptr.style.height = '0';
    });
  })();
  $('cOmr').addEventListener('input', calc);
  $('hSend').onclick = function () { openSend(null, Number($('cOmr').value) || ''); };
  $('svMob').onclick = function () { haptic(); openSend('mobile'); };
  $('svBank').onclick = function () { haptic(); openSend('bank'); };
  $('svBill').onclick = function () { haptic(); openSend('bill'); };
  $('hBalBtn').onclick = function () { S.stack = ['hist']; show('hist', false); };
  $('hRefresh').onclick = function () { var b = this; b.disabled = true; Promise.all([loadMe(), loadOrders()]).then(function () { b.disabled = false; drawHome(); toast('Imesasishwa'); }); };
  $('hRec').onclick = function (e) { var b = e.target.closest('[data-r]'); if (!b) return; var k = b.getAttribute('data-r'); openSend(k === 'new' ? 'new' : (S.me.recipients || [])[+k]); };
  $('hActive').onclick = function (e) { var b = e.target.closest('[data-ref]'); if (b) openTrack(b.getAttribute('data-ref')); };
  function pill(o) {
    var t = { 'new': ['p-new', 'Inasubiri'], ok: ['p-ok', 'Inatumwa'], paid: ['p-paid', 'Imelipwa'], no: ['p-no', 'Haijaonekana'], stop: ['p-stop', 'Imesitishwa'], hold: ['p-new', 'Thibitisha jina'], part: ['p-ok', 'Nusu imetumwa'], cancel: ['p-stop', 'Imeghairiwa'] }[o.st] || ['p-new', o.st];
    return '<span class="pill ' + t[0] + '">' + t[1] + '</span>';
  }

  /* ---------- tuma ---------- */
  function fillSelect(sel, list, ph) { sel.innerHTML = '<option value="">' + ph + '</option>' + list.map(function (x) { return '<option>' + esc(x) + '</option>'; }).join(''); }
  function netFor(p) {
    var d = String(p || '').replace(/\D/g, ''); if (d.indexOf('255') === 0) d = d.slice(3); if (d.charAt(0) === '0') d = d.slice(1);
    if (d.length < 2) return ''; var x = d.slice(0, 2);
    var N = { 'Mixx by Yas': ['65', '67', '71', '77', '70'], 'Vodacom M-Pesa': ['74', '75', '76', '79', '72'], 'Airtel Money': ['68', '69', '78', '66'], 'Halopesa': ['62', '61', '63'], 'TTCL T-Pesa': ['73'] };
    for (var k in N) if (N[k].indexOf(x) >= 0) return k; return '';
  }
  function openSend(rec, amount) {
    S.ck = '';
    var i = info() || {};
    fillSelect($('rNet'), i.nets || ['Mixx by Yas', 'Vodacom M-Pesa', 'Airtel Money', 'Halopesa', 'TTCL T-Pesa'], 'Chagua mtandao');
    S.netManual = false; $('rNetTag').style.display = 'none'; $('rNetBox').style.display = 'none';
    S.bankManual = false; $('rBankTag').style.display = 'none'; $('rBankSel').style.display = 'none';
    fillSelect($('rBank'), i.banks || ['CRDB', 'NMB', 'NBC', 'PBZ'], 'Chagua benki');
    drawPay(i.payOmr || '');

    if (amount) $('sOmr').value = amount;
    $('sErr').textContent = '';
    var saved = (S.me && S.me.recipients) || [];
    S.rec = rec === 'new' || !saved.length ? null : (rec || saved[0]);
    drawSaved(saved, rec === 'new' || !saved.length);
    if (rec === 'bill') { S.rec = null; drawSaved(saved, true); setKind('bill'); }
    else if (rec === 'mobile' || rec === 'bank') { S.rec = null; drawSaved(saved, true); setKind(rec); }
    if (rec === 'bill' || rec === 'mobile' || rec === 'bank') setTimeout(function () { var k = $('kMob').parentNode; if (k && k.scrollIntoView) k.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 350);
    setAmt((S.rec && isBill(S.rec.net)) || (!S.rec && S.kind === 'bill'));
    S.useBal = false; drawBalOpt();
    sCalc();
    S.stack.push('send'); show('send', false);
  }
  function drawSaved(saved, wantNew) {
    var top = saved.slice(0, 5);
    if (S.rec && !top.some(function (r) { return r.rp === S.rec.rp; })) top = [S.rec].concat(saved.slice(0, 4));
    $('sAllBtn').style.display = saved.length > 5 ? 'flex' : 'none'; $('sAllTxt').textContent = 'Wapokeaji wote (' + saved.length + ') · tafuta';
    $('sSaved').innerHTML = top.map(function (r) {
      var on = S.rec && S.rec.rp === r.rp, k = saved.indexOf(r) >= 0 ? saved.indexOf(r) : saved.map(function (x) { return x.rp; }).indexOf(r.rp);
      return '<button class="opt' + (on ? ' on' : '') + '" data-k="' + k + '"><span class="avs" style="background:var(--lime-soft)">' + esc(initials(r.rn)) + '</span>'
        + '<span style="flex:1;display:flex;flex-direction:column;gap:2px;min-width:0"><span style="font-weight:800;font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(r.rn) + '</span>'
        + '<span class="mut" style="font-size:13px">' + (r.fav ? '⭐ ' : '') + (isBill(r.net) ? (BL[r.net].ic + ' ') : '') + esc(r.net || '') + ' · ' + esc(r.rp) + '</span></span>' + (on ? svg('check', 22, '#1F7A32', 2.4) : '') + '</button>';
    }).join('');
    $('sNew').style.display = wantNew ? 'flex' : 'none';
    $('sNewBtn').style.display = wantNew ? 'none' : 'flex';
  }
  $('sSaved').onclick = function (e) {
    var b = e.target.closest('[data-k]'); if (!b) return;
    S.rec = (S.me.recipients || [])[+b.getAttribute('data-k')]; drawSaved(S.me.recipients || [], false); if (isBill(S.rec.net)) setAmt(true);
   sCalc(); };
  $('sAllBtn').onclick = function () { openBook('one', function (r) { S.rec = r; drawSaved(S.me.recipients || [], false); if (isBill(r.net)) setAmt(true); sCalc(); haptic(); }); };
  $('sNewBtn').onclick = function () { S.rec = null; drawSaved((S.me && S.me.recipients) || [], true); sCalc(); $('rName').focus(); };
  /* LUKU na bili: wakala analipa; LUKU/ZECO token inarudi kwenye app */
  /* Bili: maelezo kwa mteja + umbo la namba (chk). Umbo likikosekana mteja anaonywa tu, haizuiwi — mamlaka hubadilisha miundo.
     Vyanzo: mwongozo wa GePG (control number 99XXXXXXXXXX, tarehe ya kuisha), tovuti za DStv/Zuku/StarTimes, mamlaka za maji (BUWASA, KUWASA). */
  var BL = {
    'LUKU TANESCO': { ic: '⚡', t: 'LUKU (TANESCO)', f: 'Namba ya mita', h: 'Tarakimu 11, iko kwenye mita au risiti ya LUKU ya zamani. Token ya tarakimu 20 itaonekana hapa kwenye app wakala akilipa.', n: 'Jina kwenye mita (hiari)',
      chk: { re: /^\d{11}$/, msg: 'Namba ya mita ya LUKU kwa kawaida ina tarakimu 11. Hakikisha umeiandika yote.' } },
    'TUKUZA': { ic: '⚡', t: 'TUKUZA (Umeme Zanzibar)', f: 'Namba ya mita (TUKUZA)', h: 'Namba ya mita ya ZECO, iko kwenye mita. Token itaonekana hapa kwenye app wakala akilipa.', n: 'Jina kwenye mita (hiari)',
      chk: { re: /^\d{9,14}$/, msg: 'Namba ya mita inatakiwa iwe tarakimu tu.' } },
    'Serikali (GePG)': { ic: '🏛', t: 'Serikali Bara (GePG)', f: 'Control number (GePG)', h: 'Tarakimu 12 zinazoanza na 99 — TRA, ada za shule/vyuo, ardhi, vibali, maji (mamlaka nyingi) n.k. Bili ina TAREHE YA KUISHA: hakikisha bado haijapita.', n: 'Ni malipo ya nini? (hiari)',
      chk: { re: /^99\d{10}$/, msg: 'Control number za GePG kwa kawaida zina tarakimu 12 na zinaanza na 99. Angalia bili yako tena.' } },
    'ZanMalipo': { ic: '🏛', t: 'Serikali Zanzibar (ZanMalipo)', f: 'Control number (ZanMalipo)', h: 'ZRB, ada za vyuo, vibali, faini na huduma nyingine za Serikali ya Zanzibar. Control number ina muda wake — ilipe kabla haijaisha.', n: 'Ni malipo ya nini? (hiari)',
      chk: { re: /^\d{8,16}$/, msg: 'Control number inatakiwa iwe tarakimu tu.' } },
    'Maji DAWASA': { ic: '💧', t: 'Maji DAWASA', f: 'Namba ya akaunti ya maji', h: 'Iko kwenye bili ya maji. Kama bili ina control number inayoanza na 99, chagua "Serikali Bara (GePG)".', n: 'Jina kwenye akaunti (hiari)' },
    'Maji ZAWA': { ic: '💧', t: 'Maji ZAWA', f: 'Namba ya akaunti ya maji', h: 'Iko kwenye bili ya maji ya ZAWA.', n: 'Jina kwenye akaunti (hiari)' },
    'Maji (mamlaka nyingine)': { ic: '💧', t: 'Maji mengine', f: 'Namba ya kampuni (business number)', r: 'Namba ya akaunti ya maji', h: 'Mamlaka nyingi za maji Bara (mf. BUWASA, KUWASA, MORUWASA) sasa zinatoa control number ya GePG inayoanza na 99 — bili yako ikiwa nayo, chagua "Serikali Bara (GePG)" badala yake.', n: 'Mamlaka ya maji ya wapi? (mf. MORUWASA)' },
    'DStv': { ic: '📺', t: 'DStv', f: 'Namba ya smartcard / IUC', h: 'Tarakimu 10, iko chini ya king\'amuzi au kwenye skrini (Menu → Settings). Mfuko utalipwa kwa kiasi hiki.', n: 'Jina kwenye akaunti (hiari)',
      chk: { re: /^\d{10,12}$/, msg: 'Smartcard ya DStv kwa kawaida ina tarakimu 10.' } },
    'Azam TV': { ic: '📺', t: 'Azam TV', f: 'Namba ya smartcard', h: 'Iko kwenye kadi ya king\'amuzi (Azam Max / Azam TV).', n: 'Jina kwenye akaunti (hiari)',
      chk: { re: /^\d{8,16}$/, msg: 'Smartcard inatakiwa iwe tarakimu tu.' } },
    'ZCTV': { ic: '📺', t: 'ZCTV', f: 'Namba ya king\'amuzi / smartcard', n: 'Jina kwenye akaunti (hiari)' },
    'StarTimes': { ic: '📺', t: 'StarTimes', f: 'Namba ya smartcard', h: 'Iko kwenye kadi ndani ya king\'amuzi au Menu → Smartcard.', n: 'Jina kwenye akaunti (hiari)',
      chk: { re: /^\d{9,12}$/, msg: 'Smartcard ya StarTimes kwa kawaida ina tarakimu 10–11.' } },
    'Zuku': { ic: '📺', t: 'Zuku', f: 'Namba ya akaunti', h: 'Namba ya akaunti ya Zuku (bila kuandika "ZUKU" mbele). Iko kwenye bili au SMS ya Zuku.', n: 'Jina kwenye akaunti (hiari)',
      chk: { re: /^(?:ZUKU)?\d{5,12}$/i, msg: 'Akaunti ya Zuku kwa kawaida ni tarakimu tu, bila herufi.' } },
    'Vocha': { ic: '📲', t: 'Vocha (salio la simu)', f: 'Namba ya simu ya Tanzania', h: 'Wakala atanunua vocha / muda wa maongezi kwa namba hii — Vodacom, Mixx, Airtel, Halotel au TTCL.', n: 'Jina (hiari)',
      chk: { re: /^0[67]\d{8}$/, msg: 'Namba ya simu ya Tanzania ina tarakimu 10 na inaanza na 06 au 07.' } },
    'Bili nyingine': { ic: '🧾', t: 'Nyingine', f: 'Namba ya kampuni / Lipa Namba', r: 'Namba ya kumbukumbu (reference)', h: 'Kama bili ina control number inayoanza na 99, chagua "Serikali Bara (GePG)".', n: 'Unamlipa nani? (mf. jina la shule)' }
  };
  BL['Umeme ZECO'] = BL['TUKUZA'];   // wapokeaji waliohifadhiwa kwa jina la zamani
  function isBill(net) { return !!BL[net]; }
  function drawBillers() {
    var L = (info() || {}).billers || Object.keys(BL);
    $('rBillers').innerHTML = L.filter(isBill).map(function (id) { var b = BL[id]; return '<button type="button" data-bl="' + esc(id) + '" class="' + (S.biller === id ? 'on' : '') + '"><span aria-hidden="true">' + b.ic + '</span>' + esc(b.t) + '</button>'; }).join('');
    var b = BL[S.biller]; $('rBillForm').style.display = b ? 'flex' : 'none'; if (!b) return;
    $('rBillAccL').textContent = b.f; $('rBillHint').textContent = b.h || ''; $('rBillNameL').textContent = b.n || 'Jina (hiari)';
    $('rBillRefBox').style.display = b.r ? 'flex' : 'none'; $('rBillRefL').textContent = b.r || '';
    $('rBillAcc').setAttribute('inputmode', S.biller === 'Vocha' ? 'tel' : /Maji|Bili|Zuku/.test(S.biller) ? 'text' : 'numeric');
  }
  $('rBillers').onclick = function (e) { var b = e.target.closest('[data-bl]'); if (!b) return; S.biller = b.getAttribute('data-bl'); drawBillers(); haptic(); $('rBillAcc').focus(); };
  /* namba ikionekana si ya umbo la kawaida: onyo la manjano chini ya kisanduku (mteja anaweza kuendelea — mamlaka hubadilisha miundo) */
  function billWarn() {
    var b = BL[S.biller], v = $('rBillAcc').value.replace(/\s+/g, '').toUpperCase(), el = $('rBillHint');
    if (b && b.chk && v.length >= 4 && !b.chk.re.test(v)) { el.textContent = '⚠️ ' + b.chk.msg; el.style.color = 'var(--warn)'; return true; }
    el.textContent = (b && b.h) || ''; el.style.color = ''; return false;
  }
  $('rBillAcc').addEventListener('input', billWarn);
  function setKind(k) {
    S.kind = k; $('kMob').classList.toggle('on', k === 'mobile'); $('kBank').classList.toggle('on', k === 'bank'); $('kBill').classList.toggle('on', k === 'bill');
    $('rMobBox').style.display = k === 'mobile' ? 'flex' : 'none'; $('rBankBox').style.display = k === 'bank' ? 'flex' : 'none'; $('rBillBox').style.display = k === 'bill' ? 'flex' : 'none';
    $('rName').parentNode.style.display = k === 'bill' ? 'none' : 'flex';
    if (k === 'bill') { drawBillers(); setAmt(true); }
    sCalc();
  }
  $('kBill').onclick = function () { setKind('bill'); };
  /* kiasi kwa OMR au kwa TZS (mf. LUKU ya TZS 20,000 kamili) */
  function omrFor(t) {
    var i = info() || {}, g = rateFor(t / (i.rate || 6700)); if (!g) return 0;
    var o = Math.ceil(t / g * 1000) / 1000, g2 = rateFor(o); if (g2 !== g) o = Math.ceil(t / g2 * 1000) / 1000; return o;
  }
  function setAmt(tz) {
    var prev = !!S.amtT; S.amtT = !!tz; $('amtO').classList.toggle('on', !tz); $('amtT').classList.toggle('on', !!tz);
    $('sOmrL').textContent = tz ? 'Wanapokea (TZS)' : 'Unatuma (OMR)'; $('sTzsL').textContent = tz ? 'Utalipa' : 'Mpokeaji atapata';
    $('sChips').style.display = tz ? 'none' : 'flex';
    if (prev !== S.amtT) { var v = Number(String($('sOmr').value).replace(/,/g, '')) || 0; if (v) $('sOmr').value = tz ? Math.round(v * rateFor(v)) : omrFor(v); }
    sCalc();
  }
  $('amtO').onclick = function () { setAmt(false); };
  $('amtT').onclick = function () { setAmt(true); };
  function amtNow() { var v = Number(String($('sOmr').value).replace(/,/g, '')) || 0; return S.amtT ? { t: Math.round(v), o: omrFor(Math.round(v)) } : { t: 0, o: Math.round(v * 1000) / 1000 }; }
  $('kMob').onclick = function () { setKind('mobile'); };
  $('kBank').onclick = function () { setKind('bank'); };
  /* mtandao unatambuliwa kutoka kwenye namba; mteja anachagua mwenyewe tu app ikishindwa (au akibonyeza Badilisha) */
  var NETC = { 'Mixx by Yas': '#1E5BB8', 'Vodacom M-Pesa': '#D3202C', 'Airtel Money': '#C8102E', 'Halopesa': '#F28C00', 'TTCL T-Pesa': '#0B7EC1' };
  function netUi(force) {
    var d = $('rPhone').value.replace(/\D/g, ''); if (d.indexOf('255') === 0) d = d.slice(3); if (d.charAt(0) === '0') d = d.slice(1);
    var n = netFor(d), tag = $('rNetTag'), box = $('rNetBox');
    if (force) { tag.style.display = 'none'; box.style.display = 'flex'; $('rNetMsg').textContent = 'Chagua mtandao'; S.netManual = true; return; }
    if (S.netManual) return;
    if (d.length < 2) { tag.style.display = 'none'; box.style.display = 'none'; $('rNet').value = ''; return; }
    if (n) {
      $('rNet').value = n; box.style.display = 'none'; tag.style.display = 'flex';
      tag.innerHTML = '<div class="row" style="flex:1;justify-content:space-between;background:var(--lime-soft);border-radius:12px;padding:10px 12px"><span class="row" style="gap:8px"><span style="width:10px;height:10px;border-radius:50%;background:' + (NETC[n] || 'var(--brand)') + '"></span><b style="font-size:14px">' + esc(n) + '</b><span class="mut" style="font-size:12px;font-weight:600">· imetambuliwa</span></span>'
        + '<button type="button" id="rNetChg" style="background:none;border:none;color:var(--brand-2);font-weight:800;font-size:13px;cursor:pointer;padding:6px">Badilisha</button></div>';
      $('rNetChg').onclick = function () { netUi(true); };
    } else if (d.length >= 2) {
      $('rNet').value = ''; tag.style.display = 'none'; box.style.display = 'flex';
      $('rNetMsg').textContent = 'Hatukuweza kutambua mtandao wa namba hii — chagua';
    }
  }
  $('rPhone').addEventListener('input', function () { netUi(false); });
  /* benki inatambuliwa kutoka mpangilio wa namba ya akaunti (sheria zile zile za bot ya WhatsApp) */
  /* Benki kwa umbo la akaunti — kutoka akaunti halisi zilizochapishwa (TRA Ilala, TBS, DStv, Zuku):
       CRDB 13: 015… / 01J… (USD 02J…) · NMB 10–11: 20… · NBC 12: 011…/012…/022… · Stanbic 12: 14… au 13: 912… · Exim 10: 08… · Ecobank 16: 0020…
       08… (tarakimu 10) inaweza kuwa PBZ au Exim → haitambuliwi, mteja anachagua. */
  var BANK_FMT = {
    CRDB: { re: /^0[12][5J]\d{10}$/, h: 'tarakimu 13, inaanza 015 au 01J' },
    NMB: { re: /^20\d{8,9}$/, h: 'tarakimu 10–11, inaanza 20' },
    NBC: { re: /^0[12]\d{10}$/, h: 'tarakimu 12, inaanza 011, 012 au 022' },
    STANBIC: { re: /^(14\d{10}|912\d{10})$/, h: 'tarakimu 12 (14…) au 13 (912…)' },
    EXIM: { re: /^08\d{8}$/, h: 'tarakimu 10, inaanza 08' },
    PBZ: { re: /^08\d{8}$/, h: 'tarakimu 10, inaanza 08' },
    ECOBANK: { re: /^0020\d{12}$/, h: 'tarakimu 16, inaanza 0020' }
  };
  function bankFor(acct) {
    var a = String(acct || '').toUpperCase().replace(/[\s-]/g, '');
    if (BANK_FMT.CRDB.re.test(a)) return 'CRDB';
    if (BANK_FMT.NMB.re.test(a)) return 'NMB';
    if (BANK_FMT.NBC.re.test(a)) return 'NBC';
    if (BANK_FMT.STANBIC.re.test(a)) return 'STANBIC';
    if (BANK_FMT.ECOBANK.re.test(a)) return 'ECOBANK';
    return '';   // 08… (PBZ/Exim) na nyingine: mteja anachagua
  }
  function bankUi(force) {
    var a = $('rAcc').value.replace(/[\s-]/g, ''), b = bankFor(a), tag = $('rBankTag'), box = $('rBankSel');
    var known = Array.prototype.some.call($('rBank').options, function (o) { return o.value === b; });
    if (force) { tag.style.display = 'none'; box.style.display = 'flex'; $('rBankMsg').textContent = 'Chagua benki'; S.bankManual = true; return; }
    if (S.bankManual) return;
    if (a.length < 8) { tag.style.display = 'none'; box.style.display = 'none'; $('rBank').value = ''; return; }
    if (b && known) {
      $('rBank').value = b; box.style.display = 'none'; tag.style.display = 'flex';
      tag.innerHTML = '<div class="row" style="flex:1;justify-content:space-between;background:var(--lime-soft);border-radius:12px;padding:10px 12px"><span class="row" style="gap:8px"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10h18L12 4z"/><path d="M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18"/></svg><b style="font-size:14px">' + esc(b) + '</b><span class="mut" style="font-size:12px;font-weight:600">· imetambuliwa</span></span>'
        + '<button type="button" id="rBankChg" style="background:none;border:none;color:var(--brand-2);font-weight:800;font-size:13px;cursor:pointer;padding:6px">Badilisha</button></div>';
      $('rBankChg').onclick = function () { bankUi(true); };
    } else {
      $('rBank').value = ''; tag.style.display = 'none'; box.style.display = 'flex';
      $('rBankMsg').textContent = /^08\d{8}$/.test(a) ? 'Akaunti hii ni ya PBZ au Exim? — chagua' : 'Hatukuweza kutambua benki ya akaunti hii — chagua';
    }
  }
  $('rAcc').addEventListener('input', function () { bankUi(false); bankWarn(); });
  $('rBank').addEventListener('change', bankWarn);
  /* benki imechaguliwa lakini akaunti haina umbo la benki hiyo → onyo la manjano (haizuii) */
  function bankWarn() {
    var a = $('rAcc').value.toUpperCase().replace(/[\s-]/g, ''), b = $('rBank').value, F = BANK_FMT[b], el = $('rAccHint');
    if (!el) return false;
    if (F && a.length >= 6 && !F.re.test(a)) { el.textContent = '⚠️ Akaunti za ' + b + ' kwa kawaida: ' + F.h + '. Angalia tena.'; el.style.color = 'var(--warn)'; el.style.display = ''; return true; }
    el.textContent = F ? b + ': ' + F.h : ''; el.style.color = ''; el.style.display = F ? '' : 'none'; return false;
  }
  function drawBalOpt() {
    var av = balAvail(), on = av > 0.0005; $('sBalOpt').style.display = on ? 'flex' : 'none';
    if (!on) S.useBal = false; $('sUseBal').checked = !!S.useBal;
    $('sBalTxt').textContent = 'Salio lako: ' + omr(av) + ' OMR · hakuna risiti inayohitajika';
    $('sPay').style.display = S.useBal ? 'none' : 'block'; $('sProofLbl').style.display = S.useBal ? 'none' : 'flex';
    $('sProofImg').style.display = !S.useBal && S.proof ? 'block' : 'none';
    $('sPayHint').textContent = S.useBal ? 'Inalipwa kutoka salio lako' : 'Lipa OMR, kisha pakia risiti';
  }
  $('sUseBal').onchange = function () { S.useBal = this.checked; drawBalOpt(); sCalc(); };
  function sCalc() {
    var A = amtNow(), o = A.o, r = rateFor(o);
    $('sRateTxt').textContent = r ? 'Rate: 1 OMR = ' + tzs(r) + ' TZS' : 'Rate: —';
    var bn = bonusFor(o);
    $('sTzs').textContent = S.amtT ? omr(o) + ' OMR' : tzs(o * r + bn) + ' TZS';
    $('sBonus').style.display = bn ? 'block' : 'none'; if (bn) $('sBonus').textContent = '🎁 Pamoja na zawadi ya rafiki TZS ' + tzs(bn);
    chipsOn('sChips', o);
    var e = limErr(o, r), i = info() || {}, k = curKind();
    $('sLim').textContent = k === 'bank' ? 'Benki: hadi ' + omr(i.maxBank || 10000) + ' OMR' : k === 'bill' ? (S.amtT && o ? 'Rate ' + tzs(r) : '') : 'Simu: hadi ' + tzs(i.maxMob || 5000000) + ' TZS';
    $('sLim').style.color = e ? 'var(--bad)' : ''; $('sLim').style.fontWeight = e ? '800' : '';
    $('sTzs').style.color = e ? 'var(--bad)' : '';
  }
  /* kikomo kinafuata aina ya mpokeaji: pesa ya simu (TZS) au benki (OMR) */
  function curKind() {
    if (S.rec && isBill(S.rec.net)) return 'bill';
    if (S.rec) return /^0[67]\d{8}$/.test(String(S.rec.rp).replace(/\D/g, '')) || /M-Pesa|Mixx|Airtel|Halo|T-Pesa|TTCL/i.test(S.rec.net || '') ? 'mobile' : 'bank';
    return S.kind || 'mobile';
  }
  function limErr(o, r) {
    var i = info() || {}, mm = i.maxMob || 5000000, mb = i.maxBank || 10000;
    if (curKind() === 'bill') return o > mb ? 'Kiasi cha bili ni kikubwa mno' : '';
    if (curKind() === 'bank') return o > mb ? 'Kwa benki, kiasi cha juu ni ' + omr(mb) + ' OMR kwa oda moja' : '';
    return r && o * r > mm ? 'Kwa pesa ya simu, kiasi cha juu ni ' + tzs(mm) + ' TZS kwa oda moja (≈ ' + omr(Math.floor(mm / r)) + ' OMR). Kwa zaidi chagua akaunti ya benki' : '';
  }
  $('sChips').onclick = function (e) { var b = e.target.closest('[data-amt]'); if (!b) return; $('sOmr').value = b.getAttribute('data-amt'); sCalc(); };
  $('sOmr').addEventListener('input', sCalc);
  /* maelezo ya malipo: kila namba (akaunti, simu) ina kitufe chake cha kunakili */
  function copyText(t) {
    var fb = function () { var ta = document.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select(); var ok = false; try { ok = document.execCommand('copy'); } catch (e) {} ta.remove(); return ok ? Promise.resolve() : Promise.reject(); };
    return navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(t).catch(fb) : fb();
  }
  function drawPayInto(id, txt) { var keep = $('sPay').innerHTML; drawPay(txt); $(id).innerHTML = $('sPay').innerHTML; $('sPay').innerHTML = keep; }
  function drawPay(txt) {
    var lines = String(txt).split(/\n+/).map(function (x) { return x.replace(/\*/g, '').trim(); }).filter(Boolean), rows = [];
    lines.forEach(function (ln) {
      var m = ln.match(/(\+?\d[\d\s-]{6,}\d)/);
      if (m) {
        var num = m[1].replace(/[\s-]/g, ''), label = ln.replace(m[1], '').replace(/[:()]+/g, ' ').replace(/\s+/g, ' ').trim();
        var kind = num.length >= 12 ? 'Namba ya akaunti' : 'Namba ya simu';
        rows.push('<div class="payrow"><div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px"><span class="mut" style="font-size:12px;font-weight:700">' + esc(label || kind) + '</span><span class="num" style="font-size:16px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(num) + '</span></div>'
          + '<button class="cpy" type="button" data-cp="' + esc(num) + '" aria-label="Nakili ' + esc(num) + '"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>Nakili</button></div>');
      } else rows.push('<div class="payrow" style="padding:8px 0"><span style="font-weight:700;font-size:15px">' + esc(ln) + '</span></div>');
    });
    $('sPay').innerHTML = rows.join('') || '<div class="payrow mut">—</div>';
  }
  $('bPay').onclick = function (e) { $('sPay').onclick.call(this, e); };
  $('sPay').onclick = function (e) {
    var b = e.target.closest('[data-cp]'); if (!b) return;
    var v = b.getAttribute('data-cp');
    copyText(v).then(function () {
      haptic(); document.querySelectorAll('#sPay .cpy.done, #bPay .cpy.done, #pdPay .cpy.done').forEach(function (x) { x.classList.remove('done'); x.lastChild.textContent = 'Nakili'; });
      b.classList.add('done'); b.lastChild.textContent = 'Imenakiliwa'; toast('✓ ' + v + ' imenakiliwa');
    }, function () { toast('Imeshindikana — bonyeza namba kwa muda kunakili'); });
  };
  $('sProof').onchange = function () {
    var f = this.files && this.files[0]; if (!f) return;
    $('sProofTxt').textContent = 'Inaandaa picha…';
    shrink(f, 1600, 0.82).then(function (d) {
      S.proof = d; $('sProofImg').src = d; $('sProofImg').style.display = 'block'; $('sProofTxt').textContent = '✓ Risiti imewekwa · badilisha';
    }).catch(function () { S.proof = ''; $('sProofTxt').textContent = 'Picha haikufunguka — jaribu nyingine'; });
  };
  function shrink(file, max, q) {
    return new Promise(function (ok, no) {
      var rd = new FileReader();
      rd.onload = function () {
        var img = new Image();
        img.onload = function () {
          var s = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas');
          c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); ok(c.toDataURL('image/jpeg', q));
        };
        img.onerror = no; img.src = rd.result;
      };
      rd.onerror = no; rd.readAsDataURL(file);
    });
  }
  $('sGo').onclick = function () {
    var btn = this, i = info() || {}, A = amtNow(), o = A.o, err = $('sErr');
    err.textContent = '';
    if (!(o >= (i.min || 1))) { err.textContent = S.amtT ? 'Kiasi cha chini ni ' + omr(i.min || 1) + ' OMR (≈ TZS ' + tzs((i.min || 1) * rateFor(i.min || 1)) + ')' : 'Weka kiasi cha OMR unachotuma'; return; }
    var le = limErr(o, rateFor(o)); if (le) { err.textContent = le; return; }
    var body = { omr: o, rate: rateFor(o) }; if (S.amtT) body.tzs = A.t;
    if (S.rec) { body.rn = S.rec.rn; body.rp = S.rec.rp; body.net = S.rec.net; body.kind = isBill(S.rec.net) ? 'bill' : /^0[67]\d{8}$/.test(String(S.rec.rp).replace(/\D/g, '')) || /M-Pesa|Mixx|Airtel|Halo|T-Pesa|TTCL/i.test(S.rec.net) ? 'mobile' : 'bank'; }
    else if (S.kind === 'bill') {
      var B0 = BL[S.biller]; if (!B0) { err.textContent = 'Chagua unacholipa (LUKU, maji, TV…)'; return; }
      body.kind = 'bill'; body.net = S.biller; body.rp = $('rBillAcc').value.replace(/\s+/g, '').toUpperCase(); body.rn = $('rBillName').value.trim(); body.bref = $('rBillRef').value.trim();
      if (body.rp.length < 3) { err.textContent = 'Weka ' + B0.f.toLowerCase(); $('rBillAcc').focus(); return; }
      if (B0.chk && !B0.chk.re.test(body.rp)) body.warn = B0.chk.msg;   // haizuii — inaonyeshwa kwenye muhtasari wa kuhakiki
      if (B0.r && body.bref.length < 2) { err.textContent = 'Weka ' + B0.r.toLowerCase(); $('rBillRef').focus(); return; }
    }
    else {
      body.rn = $('rName').value; body.kind = S.kind;
      if (S.kind === 'mobile') { body.rp = $('rPhone').value; body.net = $('rNet').value; } else { body.rp = $('rAcc').value; body.net = $('rBank').value; }
      if (String(body.rn).trim().length < 3) { err.textContent = 'Weka jina kamili la mpokeaji'; return; }
      if (!body.rp) { err.textContent = S.kind === 'mobile' ? 'Weka namba ya simu ya mpokeaji' : 'Weka namba ya akaunti'; return; }
      if (!body.net) { if (S.kind === 'mobile') { netUi(true); err.textContent = 'Chagua mtandao wa mpokeaji'; } else { bankUi(true); err.textContent = 'Chagua benki ya mpokeaji'; } return; }
      if (S.kind === 'bank') { var BF = BANK_FMT[body.net], ba = String(body.rp).toUpperCase().replace(/[\s-]/g, ''); if (BF && !BF.re.test(ba)) body.warn = 'Akaunti za ' + body.net + ' kwa kawaida: ' + BF.h + '.'; }
    }
    if (S.useBal) {
      if (balAvail() + 0.0005 < o) { err.textContent = 'Salio lako ni ' + omr(balAvail()) + ' OMR tu — halitoshi kwa oda hii. Ondoa alama ya "Lipa kwa salio" ulipe kawaida.'; return; }
      body.useBal = 1;
    } else {
      if (!S.proof) { err.textContent = 'Pakia picha ya risiti ya malipo yako ya OMR kwanza'; return; }
      body.img = S.proof;
    }
    if (!S.ck) S.ck = 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    body.ck = S.ck;
    review(body);
  };
  /* hakiki kabla ya kutuma — hakuna oda inayotumwa bila mteja kuthibitisha */
  function review(body) {
    var r = rateFor(body.omr), net = body.net || '';
    $('cfAmt').textContent = omr(body.omr) + ' OMR';
    var bn = bonusFor(body.omr);
    $('cfTzs').textContent = tzs(body.omr * r + bn) + ' TZS';
    if (body.tzs) $('cfTzs').textContent = tzs(body.tzs + bn) + ' TZS';
    var bb = body.kind === 'bill' ? (BL[net] || {}) : null;
    $('cfRows').innerHTML = (bb ? [['Malipo', (bb.ic || '') + ' ' + (bb.t || net)], [bb.f || 'Namba', body.rp]].concat(body.bref ? [[bb.r || 'Kumbukumbu', body.bref]] : []).concat(body.rn ? [['Jina', body.rn]] : []).concat([['Rate', '1 OMR = ' + tzs(r) + ' TZS']])
      : [['Mpokeaji', String(body.rn || '').toUpperCase()], [body.kind === 'bank' ? 'Benki' : 'Mtandao', net], [body.kind === 'bank' ? 'Akaunti' : 'Namba', body.rp], ['Rate', '1 OMR = ' + tzs(r) + ' TZS']]).concat(bn ? [['🎁 Zawadi ya rafiki', '+ ' + tzs(bn) + ' TZS']] : [])
      .map(function (x) { return '<div class="row" style="justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--line)"><span class="mut" style="font-weight:600">' + esc(x[0]) + '</span><b class="num" style="text-align:right">' + esc(x[1]) + '</b></div>'; }).join('');
    if (body.useBal) $('cfRows').innerHTML += '<div class="row" style="justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--line)"><span class="mut" style="font-weight:600">Malipo</span><b style="color:var(--ok-ink)">💰 Kutoka salio lako</b></div>';
    if (body.warn) $('cfRows').innerHTML += '<div style="padding:10px 12px;margin-top:8px;border-radius:10px;background:var(--warn-soft,#FBF1DC);color:var(--warn);font-size:13px;font-weight:600">⚠️ ' + esc(body.warn) + ' Ukiendelea na namba isiyo sahihi, malipo yanaweza kwenda kwa mtu mwingine.</div>';
    $('cfImg').src = body.img || ''; $('cfImg').parentNode.style.display = body.useBal ? 'none' : 'flex';
    var cf = $('cf'); cf.classList.add('on'); $('cfErr').textContent = '';
    $('cfNo').onclick = function () { cf.classList.remove('on'); };
    $('cfGo').onclick = function () { submit(body, this); };
  }
  function submit(body, btn) {
    var err = $('cfErr'); err.textContent = '';
    if (btn.disabled) return;
    busy(btn, true, 'Inatuma oda…');
    var send = Object.assign({}, body); delete send.warn;   // onyo ni la skrini tu
    api('w_order', send).then(function (j) {
      busy(btn, false);
      if (!j.ok && j.error === 'twin') {
        if (confirm(j.msg + '\n\nBonyeza OK kutuma oda nyingine tena.')) { body.again = 1; return submit(body, btn); }
        $('cf').classList.remove('on'); loadOrders().then(function () { S.stack = ['home']; openTrack(j.ref); }); return;
      }
      if (!j.ok) { err.textContent = j.msg || 'Imeshindikana'; if (j.error === 'bal') loadMe().then(drawBalOpt); if (j.error === 'rate') Promise.all([loadInfo(), loadMe()]).then(function () { sCalc(); $('cf').classList.remove('on'); $('sErr').textContent = j.msg; }); return; }
      $('cf').classList.remove('on'); S.ck = ''; S.useBal = false;
      S.proof = ''; $('sProof').value = ''; $('sProofImg').style.display = 'none'; $('sProofTxt').textContent = 'Pakia picha ya risiti'; $('sOmr').value = '';
      ['rName', 'rPhone', 'rAcc', 'rBillAcc', 'rBillRef', 'rBillName'].forEach(function (id) { $(id).value = ''; });
      if (!j.dup) { S.orders.unshift(j.order); LS.set('yzw_orders', S.orders); }
      S.stack = ['home']; showOk(j.order);
      loadMe(); loadOrders();
    }).catch(function (e) { busy(btn, false); err.textContent = e.message + ' — oda haijatumwa, jaribu tena.'; });
  }

  /* ---------- imefanikiwa ---------- */
  function showOk(o) {
    $('okT').textContent = 'Oda imepokelewa!'; $('okTrack').textContent = 'Fuatilia order';
    $('okAmt').textContent = tzs(o.tzs) + ' TZS';
    $('okTxt').textContent = o.kind === 'bill' ? (o.net || 'Bili') + ' · ' + o.rp + '. Tunathibitisha malipo yako sasa — utapata taarifa ikilipwa' + (/LUKU|ZECO|TUKUZA/.test(o.net) ? ', na TOKEN itaonekana kwenye app.' : '.') : 'Kwa ' + (o.rn || 'mpokeaji') + (o.net ? ' · ' + o.net : '') + '. Tunathibitisha malipo yako sasa — utapata taarifa pesa ikifika.';
    $('okRef').textContent = o.ref; $('ok').classList.add('on'); haptic();
    $('okTrack').onclick = function () { $('ok').classList.remove('on'); openTrack(o.ref); };
    $('okHome').onclick = function () { $('ok').classList.remove('on'); S.stack = ['home']; show('home', false); };
  }

  /* ---------- fuatilia ---------- */
  function openTrack(ref) { S.cur = ref; S.stack.push('track'); show('track', false); }
  function drawTrack() {
    var o = S.orders.filter(function (x) { return x.ref === S.cur; })[0];
    $('tTitle').textContent = 'Oda ' + (S.cur || '');
    if (!o) { $('tBody').innerHTML = '<div class="empty">Oda haipatikani</div>'; return; }
    var steps = [
      ['Oda imepokelewa', when(o.at), 1],
      ['Malipo yako yamethibitishwa', o.okAt ? when(o.okAt) : (o.step >= 2 ? 'Imethibitishwa' : 'Tunaangalia risiti yako'), 2],
      [o.kind === 'bill' ? 'Bili imelipwa' : 'Pesa imefika Tanzania', o.paidAt ? when(o.paidAt) + (o.okAt ? ' · ndani ya dakika ' + Math.max(1, Math.round((o.paidAt - o.at) / 60000)) : '') : 'Bado', 3]
    ];
    var bad = o.st === 'no' || o.st === 'stop';
    var h = '<div style="background:var(--brand);color:#fff;border-radius:20px;padding:18px;display:flex;flex-direction:column;gap:8px">'
      + '<div class="row" style="justify-content:space-between"><span style="font-size:13px;color:var(--on-brand-mut)">' + (o.kind === 'bill' ? ((BL[o.net] || {}).ic || '🧾') + ' ' + esc(o.net) + ' · ' + esc(o.rp) : 'Kwa ' + esc(o.rn || 'mpokeaji') + (o.net ? ' · ' + esc(o.net) : '')) + '</span>' + pill(o) + '</div>'
      + '<div class="num" style="font-size:28px;font-weight:700;color:var(--lime)">' + tzs(o.tzs) + ' TZS</div>'
      + '<div style="font-size:13px;color:var(--on-brand-mut)">Umetuma ' + omr(o.omr) + ' OMR · Rate ' + tzs(o.rate) + (o.rp ? ' · ' + esc(o.rp) : '') + (o.bonus ? ' · 🎁 zawadi TZS ' + tzs(o.bonus) : '') + '</div>' + (o.bt ? '<div style="font-size:12px;color:var(--on-brand-mut);font-weight:700">📦 Kundi ' + esc(o.bt) + ' · mpokeaji ' + o.bn + ' kati ya ' + o.bc + '</div>' : '') + '</div>';
    if (o.st === 'cancel') {
      h += '<div class="card" style="font-size:14px;line-height:1.55"><b>Umeghairi oda hii.</b> Haitashughulikiwa. Kama ulishalipa OMR, wasiliana nasi WhatsApp tukurudishie.</div>'
        + '<a class="btn ghost" target="_blank" rel="noopener" href="https://wa.me/' + HELP_WA + '?text=' + encodeURIComponent('Habari, nimeghairi oda ' + o.ref) + '">Wasiliana nasi WhatsApp</a>';
    } else if (o.st === 'hold') {
      var wa = function (t) { return 'https://wa.me/' + HELP_WA + '?text=' + encodeURIComponent(t); };
      h += '<div class="card" style="border-color:#F2D49B;background:var(--warn-soft);display:flex;flex-direction:column;gap:10px">'
        + '<b style="color:var(--warn);font-size:16px">⚠️ Jina la mpokeaji ni tofauti</b>'
        + '<div style="font-size:14px;line-height:1.55">Wakala alipoweka namba <b>' + esc(o.rp) + '</b>, mtandao ulionyesha jina:</div>'
        + '<div class="num" style="font-size:18px;font-weight:700">' + esc(o.note || '—') + '</div>'
        + '<div style="font-size:14px">Uliandika: <b>' + esc(o.rn) + '</b></div>'
        + '<div style="font-size:14px;font-weight:700">Pesa bado HAIJATUMWA. Tafadhali thibitisha:</div></div>'
        + '<button class="btn" id="tHoldYes">✅ Ndiyo, ni mtu sahihi — tumeni</button>'
        + '<button class="btn ghost" id="tHoldNo">✏️ Hapana — nitatoa namba sahihi</button>'
        + '<div id="tHoldForm" class="card" style="display:none;flex-direction:column;gap:10px">'
        + '<label class="lbl" style="display:flex;flex-direction:column;gap:6px">Jina kamili la mpokeaji<input id="tHrn" class="field" autocomplete="off" autocapitalize="characters" placeholder="mf. AMINA JUMA"></label>'
        + '<label class="lbl" style="display:flex;flex-direction:column;gap:6px">Namba ya simu / akaunti<input id="tHrp" class="field" inputmode="tel" autocomplete="off" placeholder="07… / akaunti ya benki"></label>'
        + '<div style="font-size:12.5px;color:var(--mut)">Hakikisha namba na jina ni sahihi — pesa itatumwa kwa mpokeaji huyu.</div>'
        + '<button class="btn dark" id="tHoldSend">Tuma kwa mpokeaji huyu</button></div>'
        + '<a class="btn ghost" target="_blank" rel="noopener" style="font-size:13px" href="' + wa('Ref ' + o.ref + ': naomba msaada kuhusu jina la mpokeaji.') + '">Au tuandikie WhatsApp</a>';
    } else if (bad) {
      h += '<div class="card" style="border-color:#F3C4BE;background:var(--bad-soft)"><b style="color:var(--bad)">' + esc(o.label) + '</b>' + (o.note ? '<div style="margin-top:6px;font-size:14px">Sababu: ' + esc(o.note) + '</div>' : '')
        + '<div style="margin-top:8px;font-size:14px">Tafadhali wasiliana nasi kwenye WhatsApp ukiwa na Ref <b>' + esc(o.ref) + '</b>.</div></div>'
        + '<a class="btn dark" target="_blank" rel="noopener" href="https://wa.me/' + HELP_WA + '?text=' + encodeURIComponent('Habari, naomba msaada kuhusu oda ' + o.ref) + '">Wasiliana nasi WhatsApp</a>';
    } else {
      if (o.kind === 'bill' && /LUKU|ZECO|TUKUZA/.test(o.net || '')) h += o.token
        ? '<div class="tokbox"><span class="lbl">🔑 TOKEN YA UMEME</span><span class="num" style="font-size:24px;font-weight:700;letter-spacing:.06em;line-height:1.3">' + esc(o.token) + '</span><button class="btn dark" type="button" data-tok="' + esc(o.token) + '">Nakili token</button><span class="mut" style="font-size:12px">Ingiza token hii kwenye mita ' + esc(o.rp) + '</span></div>'
        : '<div class="tokbox" style="border-style:dotted"><span class="lbl">🔑 TOKEN YA UMEME</span><span class="mut" style="font-size:14px">Token itaonekana hapa wakala akishalipa — utapata pia taarifa juu ya simu.</span></div>';
      if (o.st === 'part') h += '<div class="card" style="border-color:#BFE3C9;background:var(--ok-soft,#EAF6EE);display:flex;flex-direction:column;gap:4px"><b style="color:var(--ok-ink,#1F7A32)">⏳ Imetumwa sehemu</b><div style="font-size:14px">TZS <b class="num">' + tzs(o.paidTzs || 0) + '</b> kati ya ' + tzs(o.tzs) + ' zimeshafika kwa ' + esc(o.rn || 'mpokeaji') + '. Zilizobaki <b class="num">' + tzs(Math.max(0, o.tzs - (o.paidTzs || 0))) + '</b> zinatumwa hivi punde.</div></div>';
      h += '<div class="card steps" style="padding:16px 16px 6px">' + steps.map(function (s, k) {
        var done = o.step >= s[2], now = !done && o.step === s[2] - 1;
        return '<div class="st' + (done ? ' done' : '') + (now ? ' now' : '') + '"><div style="display:flex;flex-direction:column;align-items:center"><span class="dot">' + (done ? svg('check', 14, '#fff', 3) : '') + '</span>' + (k < 2 ? '<span class="bar"></span>' : '') + '</div>'
          + '<div style="display:flex;flex-direction:column;gap:2px;padding:2px 0 ' + (k < 2 ? '8' : '10') + 'px"><span style="font-weight:800;font-size:15px;' + (done ? '' : 'color:var(--mut)') + '">' + s[0] + '</span><span class="mut" style="font-size:13px">' + esc(s[1]) + '</span></div></div>';
      }).join('') + '</div>';
      if (o.receipt) {
        h += '<div style="display:flex;flex-direction:column;gap:10px"><span class="lbl">Risiti ya malipo Tanzania</span>'
          + '<button id="tRc" class="card" style="padding:8px;cursor:zoom-in;min-height:120px;display:flex;align-items:center;justify-content:center" aria-label="Ona risiti kubwa"><span class="spin" aria-hidden="true" style="color:var(--brand)"></span></button>'
          + '<button class="btn dark" id="tShare"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4"/><path d="m15.4 6.5-6.8 4"/></svg>Shiriki risiti (picha)</button>'
          + '<button class="btn ghost" id="tPdf">Pakua risiti (PDF)</button></div>';
      } else if (o.st === 'paid') {
        h += '<div class="card mut" style="font-size:14px">Pesa imetumwa. Risiti itaonekana hapa wakala akiipakia.</div>';
      } else {
        if (o.st === 'new') h += '<button class="btn ghost" id="tCancel" style="color:var(--bad)">Ghairi oda hii</button>';
        h += '<div class="card mut" style="font-size:14px">Ukurasa huu unajisasisha wenyewe. Pesa ikifika, risiti itaonekana hapa na pia utatumiwa kwenye WhatsApp.</div>';
      }
    }
    $('tBody').innerHTML = h;
    var tk = $('tBody').querySelector('[data-tok]'); if (tk) tk.onclick = function () { var b = this; copyText(b.getAttribute('data-tok')).then(function () { haptic(); b.textContent = '✓ Imenakiliwa'; toast('✓ Token imenakiliwa'); setTimeout(function () { b.textContent = 'Nakili token'; }, 2000); }); };
    var hy = $('tHoldYes'), hn = $('tHoldNo'), hs = $('tHoldSend');
    var holdReply = function (btn, body, okMsg) {
      busy(btn, true, 'Inatuma…');
      api('w_holdreply', body).then(function (j) { busy(btn, false); if (!j.ok) return toast(j.msg || 'Imeshindikana');
        haptic(); S.orders = S.orders.map(function (x) { return x.ref === o.ref ? j.order : x; }); LS.set('yzw_orders', S.orders); drawTrack(); toast(okMsg); })
        .catch(function (e) { busy(btn, false); toast(e.message); });
    };
    if (hy) hy.onclick = function () { if (!confirm('Thibitisha: ' + (o.note || '') + ' ndiye mpokeaji sahihi? Pesa itatumwa kwake sasa.')) return; holdReply(this, { ref: o.ref, ok: true }, '✅ Asante — wakala anatuma sasa'); };
    if (hn) hn.onclick = function () { var f = $('tHoldForm'); f.style.display = f.style.display === 'none' ? 'flex' : 'none'; if (f.style.display === 'flex') $('tHrn').focus(); };
    if (hs) hs.onclick = function () { var rn = $('tHrn').value.trim(), rp = $('tHrp').value.replace(/[\s-]/g, '');
      if (rn.length < 2) return toast('Andika jina kamili la mpokeaji'); if (rp.length < 9) return toast('Namba/akaunti si sahihi');
      if (!confirm('Tuma TZS ' + tzs(o.tzs) + ' kwa ' + rn.toUpperCase() + ' · ' + rp + '?')) return;
      holdReply(this, { ref: o.ref, ok: false, rn: rn, rp: rp }, '✏️ Mpokeaji amebadilishwa — wakala anatuma sasa'); };
    var cb = $('tCancel');
    if (cb) cb.onclick = function () {
      if (!confirm('Ghairi oda ' + o.ref + ' ya ' + omr(o.omr) + ' OMR kwa ' + o.rn + '?')) return;
      var b = this; busy(b, true, 'Inaghairi…');
      api('w_cancel', { ref: o.ref }).then(function (j) { busy(b, false); if (!j.ok) return toast(j.msg || 'Imeshindikana');
        S.orders = S.orders.map(function (x) { return x.ref === o.ref ? j.order : x; }); LS.set('yzw_orders', S.orders); drawTrack(); toast('Oda imeghairiwa'); })
        .catch(function (e) { busy(b, false); toast(e.message); });
    };
    if (o.receipt) {
      receiptImg(o).then(function (url) {
        var b = $('tRc'); if (!b || S.cur !== o.ref) return;
        b.innerHTML = '<img src="' + url + '" alt="Risiti ya ' + esc(o.ref) + '" style="width:100%;border-radius:14px;display:block">';
        b.onclick = function () { viewReceipt(o, url); };
      }, function (e) { var b = $('tRc'); if (b) b.innerHTML = '<span class="mut" style="font-size:14px">' + esc(e.message || 'Risiti haikupatikana') + ' · bonyeza kujaribu tena</span>'; if (b) b.onclick = drawTrack; });
      $('tShare').onclick = function () { shareReceipt(o, this); };
      $('tPdf').onclick = function () { receiptPdf(o, this); };
    }
  }

  /* ---------- risiti kama picha (ndani ya app, bila link) ---------- */
  var RC = {}, RCR = {};
  var MARK = 'M12 28 L30 78 L50 44 L70 78 L88 28 M70 28 L88 28 L88 46';   // nembo ya WakalaOnline: W + mshale (mstari, si fill)
  function drawMark(g) { g.strokeStyle = '#A6D33C'; g.lineWidth = 14; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke(new Path2D(MARK)); }
  function loadImg(src) { return new Promise(function (ok, no) { var i = new Image(); i.onload = function () { ok(i); }; i.onerror = no; i.src = src; }); }
  function receiptImg(o) {
    if (RC[o.ref]) return Promise.resolve(RC[o.ref]);
    return api('w_receipt', { ref: o.ref }).then(function (j) {
      if (!j.ok) throw new Error(j.msg || 'Risiti haikupatikana');
      var srcs = (j.imgs && j.imgs.length ? j.imgs : [{ mime: j.mime, img: j.img }]).map(function (x) { return 'data:' + (x.mime || 'image/jpeg') + ';base64,' + x.img; });
      RCR[o.ref] = srcs;
      return Promise.all([Promise.all(srcs.map(loadImg)), document.fonts ? document.fonts.ready : null]).then(function (r) {
        var phs = r[0], W = 1080, pad = 56, iw = W - pad * 2, gap = 24, head = 250, info = 400, foot = 120;
        var hs = phs.map(function (p) { return Math.round(p.height * iw / p.width); }), ih = hs.reduce(function (a, b) { return a + b; }, 0) + gap * (phs.length - 1);
        var H = head + info + ih + foot + 40, c = document.createElement('canvas'); c.width = W; c.height = H;
        var g = c.getContext('2d');
        g.fillStyle = '#F4F6F2'; g.fillRect(0, 0, W, H);
        g.fillStyle = '#1F7A32'; g.fillRect(0, 0, W, head);
        g.fillStyle = 'rgba(255,255,255,0.08)'; g.beginPath(); g.arc(W - 90, -40, 230, 0, 7); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.14)'; rr(g, pad, 62, 116, 116, 30); g.fill();
        g.save(); g.translate(pad, 57); g.scale(1.16, 1.16); drawMark(g); g.restore();
        g.fillStyle = '#FFFFFF'; g.font = '700 54px Sora, sans-serif'; g.fillText('WakalaOnline', pad + 146, 118);
        g.fillStyle = '#DCEFE2'; g.font = '600 30px Manrope, sans-serif'; g.fillText('Risiti ya malipo · Tanzania', pad + 146, 164);
        g.fillStyle = '#A6D33C'; g.font = '700 30px Manrope, sans-serif'; g.textAlign = 'right'; g.fillText('✓ IMELIPWA', W - pad, 118); g.textAlign = 'left';
        var y = head + 34; g.fillStyle = '#FFFFFF'; rr(g, pad, y, iw, info - 50, 28); g.fill();
        g.fillStyle = '#0F2A1C'; g.font = '700 64px Sora, sans-serif'; g.fillText(tzs(o.tzs) + ' TZS', pad + 36, y + 92);
        var rows = [['Mpokeaji', o.rn || '—'], ['Namba / akaunti', (o.net ? o.net + ' · ' : '') + (o.rp || '')], ['Ref', o.ref], ['Tarehe', when(o.paidAt || j.at || o.at)]];
        g.font = '600 31px Manrope, sans-serif';
        rows.forEach(function (rw, k) { var yy = y + 160 + k * 52; g.fillStyle = '#5B6B62'; g.fillText(rw[0], pad + 36, yy); g.fillStyle = '#0F2A1C'; g.textAlign = 'right'; g.fillText(fit(g, String(rw[1]), iw - 380), W - pad - 36, yy); g.textAlign = 'left'; });
        y = head + info + 10;
        phs.forEach(function (ph, k) {
          g.save(); rr(g, pad, y, iw, hs[k], 26); g.clip(); g.drawImage(ph, pad, y, iw, hs[k]); g.restore();
          if (phs.length > 1) { g.fillStyle = 'rgba(0,0,0,0.6)'; rr(g, pad + 16, y + 16, 96, 46, 23); g.fill(); g.fillStyle = '#fff'; g.font = '700 26px Manrope, sans-serif'; g.textAlign = 'center'; g.fillText((k + 1) + '/' + phs.length, pad + 64, y + 48); g.textAlign = 'left'; }
          y += hs[k] + gap;
        });
        g.fillStyle = '#5B6B62'; g.font = '600 28px Manrope, sans-serif'; g.textAlign = 'center';
        g.fillText('WakalaOnline · Tuma pesa Tanzania kwa urahisi', W / 2, H - 58); g.textAlign = 'left';
        var url = c.toDataURL('image/jpeg', 0.9); RC[o.ref] = url; return url;
      });
    });
  }
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function fit(g, t, max) { if (g.measureText(t).width <= max) return t; while (t.length > 3 && g.measureText(t + '…').width > max) t = t.slice(0, -1); return t + '…'; }
  function viewReceipt(o, url) {
    var v = $('rv'); $('rvImg').src = url; $('rvImg').alt = 'Risiti ya ' + o.ref; v.classList.add('on');
    $('rvShare').onclick = function () { shareReceipt(o, this); };
    $('rvClose').onclick = function () { v.classList.remove('on'); };
  }
  /* faili (picha au PDF) → menyu ya Android ya kushiriki; kwenye kivinjari → kupakua */
  function shareFile(name, b64, mime, text) {
    var C = window.Capacitor && window.Capacitor.Plugins, FS = C && C.Filesystem, SH = C && C.Share;
    if (FS && SH) return FS.writeFile({ path: name, data: b64, directory: 'CACHE' }).then(function (w) { return SH.share({ title: name, text: text, files: [w.uri], dialogTitle: 'Shiriki' }); });
    var bin = atob(b64), arr = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    var file = new File([arr], name, { type: mime });
    if (navigator.canShare && navigator.canShare({ files: [file] })) return navigator.share({ files: [file], title: name, text: text });
    var a = document.createElement('a'), u = URL.createObjectURL(file); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 4000); toast('Faili limehifadhiwa');
    return Promise.resolve();
  }
  function shareErr(e) { if (e && /cancel/i.test(String(e.message || e))) return; toast((e && e.message) || 'Imeshindikana kushiriki'); }
  function shareReceipt(o, btn) {
    var name = 'WakalaOnline-Risiti-' + String(o.ref).replace(/[^\w-]/g, '') + '.jpg', text = 'Risiti ya WakalaOnline · ' + tzs(o.tzs) + ' TZS kwa ' + (o.rn || '') + ' · Ref ' + o.ref;
    busy(btn, true, 'Inaandaa…');
    receiptImg(o).then(function (url) { return shareFile(name, url.split(',')[1], 'image/jpeg', text); }).catch(shareErr).then(function () { busy(btn, false); });
  }

  /* ---------- PDF: risiti ya oda na taarifa ya miamala ---------- */
  function PDF() { var J = window.jspdf && window.jspdf.jsPDF; if (!J) throw new Error('PDF haipatikani'); return J; }
  function logoPng() {
    var c = document.createElement('canvas'); c.width = c.height = 120; var g = c.getContext('2d');
    g.fillStyle = '#1F7A32'; rr(g, 0, 0, 120, 120, 28); g.fill();
    g.save(); g.translate(0, -4.8); g.scale(1.2, 1.2); drawMark(g); g.restore();
    return c.toDataURL('image/png');
  }
  function pdfHead(doc, W, title, sub) {
    doc.setFillColor(31, 122, 50); doc.rect(0, 0, W, 30, 'F');
    doc.addImage(logoPng(), 'PNG', 12, 7, 16, 16);
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text('WakalaOnline', 32, 15);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(220, 239, 226); doc.text(title, 32, 21.5);
    if (sub) { doc.setFontSize(9); doc.text(sub, W - 12, 15, { align: 'right' }); }
  }
  function pdfFoot(doc, W, H) {
    var n = doc.getNumberOfPages();
    for (var p = 1; p <= n; p++) { doc.setPage(p); doc.setFontSize(8); doc.setTextColor(120, 130, 125);
      doc.text('WakalaOnline · Tuma pesa Tanzania kwa urahisi', 12, H - 8); doc.text('Ukurasa ' + p + '/' + n, W - 12, H - 8, { align: 'right' }); }
  }
  function receiptPdf(o, btn) {
    busy(btn, true, 'Inaandaa PDF…');
    receiptImg(o).then(function (url) {
      var J = PDF(), doc = new J({ unit: 'mm', format: 'a4' }), W = 210, H = 297;
      pdfHead(doc, W, 'Risiti ya malipo · Tanzania', 'Ref ' + o.ref);
      doc.setTextColor(15, 42, 28); doc.setFont('helvetica', 'bold'); doc.setFontSize(22); doc.text(tzs(o.tzs) + ' TZS', 12, 46);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(91, 107, 98);
      var rows = [['Mpokeaji', o.rn || '-'], [o.net || 'Mtandao / benki', o.rp || ''], ['Umetuma', omr(o.omr) + ' OMR · rate ' + tzs(o.rate)], ['Ref', o.ref], ['Imelipwa', when(o.paidAt || o.at)], ['Hali', 'IMELIPWA']];
      rows.forEach(function (r, k) { var y = 56 + k * 7; doc.setTextColor(91, 107, 98); doc.text(String(r[0]), 12, y); doc.setTextColor(15, 42, 28); doc.text(String(r[1]), W - 12, y, { align: 'right' }); });
      var list = RCR[o.ref] || [url];
      return Promise.all(list.map(loadImg)).then(function (ims) {
        doc.setFontSize(9.5); doc.setTextColor(91, 107, 98); doc.text('Risiti ya wakala (Tanzania)' + (ims.length > 1 ? ' · picha ' + ims.length : '') + ':', 12, 98);
        var top = 102;
        ims.forEach(function (im, k) {   // picha ya kwanza chini ya maelezo, nyingine kila moja ukurasa wake
          if (k) { doc.addPage(); pdfHead(doc, W, 'Risiti ya malipo · picha ' + (k + 1) + '/' + ims.length, 'Ref ' + o.ref); top = 40; }
          var cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height; cv.getContext('2d').drawImage(im, 0, 0);
          var maxW = W - 24, maxH = H - top - 18, w = maxW, h = im.height * w / im.width; if (h > maxH) { h = maxH; w = im.width * h / im.height; }
          doc.addImage(cv.toDataURL('image/jpeg', 0.9), 'JPEG', (W - w) / 2, top, w, h);
        });
        pdfFoot(doc, W, H);
        var b64 = doc.output('datauristring').split(',')[1];
        return shareFile('WakalaOnline-Risiti-' + String(o.ref).replace(/[^\w-]/g, '') + '.pdf', b64, 'application/pdf', 'Risiti ya WakalaOnline · Ref ' + o.ref);
      });
    }).catch(shareErr).then(function () { busy(btn, false); });
  }
  var LBL = { 'new': 'Inasubiri', ok: 'Inatumwa', paid: 'Imelipwa', no: 'Haijaonekana', stop: 'Imesitishwa', hold: 'Thibitisha jina', cancel: 'Imeghairiwa' };
  function statementPdf(period, btn) {
    var now = new Date(), from = 0, to = Infinity, label = 'Kipindi chote';
    if (period === 'this') { from = new Date(now.getFullYear(), now.getMonth(), 1).getTime(); label = monthName(now); }
    if (period === 'last') { var d = new Date(now.getFullYear(), now.getMonth() - 1, 1); from = d.getTime(); to = new Date(now.getFullYear(), now.getMonth(), 1).getTime(); label = monthName(d); }
    busy(btn, true, 'Inaandaa PDF…');
    loadOrders().then(function () {
      var L = S.orders.filter(function (o) { return o.at >= from && o.at < to; }).sort(function (a, b) { return a.at - b.at; });
      if (!L.length) throw new Error('Hakuna miamala kwenye ' + label);
      var J = PDF(), doc = new J({ unit: 'mm', format: 'a4' }), W = 210, H = 297, me = S.me || {};
      var done = L.filter(function (o) { return o.st === 'paid' || o.st === 'ok'; }), so = 0, st = 0;
      done.forEach(function (o) { so += Number(o.omr) || 0; st += Number(o.tzs) || 0; });
      pdfHead(doc, W, 'Taarifa ya miamala', label);
      doc.setTextColor(15, 42, 28); doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text(me.name || 'Mteja wa WakalaOnline', 12, 42);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(91, 107, 98);
      doc.text('+' + (me.phone || '') + '   ·   Imetolewa ' + new Date().toLocaleDateString('en-GB'), 12, 48);
      var box = function (x, t, v) { doc.setFillColor(238, 246, 220); doc.roundedRect(x, 54, 58, 20, 3, 3, 'F'); doc.setFontSize(8.5); doc.setTextColor(63, 90, 18); doc.text(t, x + 4, 61); doc.setFont('helvetica', 'bold'); doc.setFontSize(12.5); doc.setTextColor(15, 42, 28); doc.text(v, x + 4, 69); doc.setFont('helvetica', 'normal'); };
      box(12, 'Miamala iliyokamilika', String(done.length)); box(76, 'Jumla OMR', omr(so)); box(140, 'Jumla TZS', tzs(st));
      doc.autoTable({
        startY: 82, margin: { left: 12, right: 12, bottom: 16 },
        head: [['Tarehe', 'Ref', 'Mpokeaji', 'Mtandao', 'OMR', 'TZS', 'Hali']],
        body: L.map(function (o) { return [new Date(o.at).toLocaleDateString('en-GB'), o.ref, o.rn || '', o.net || '', omr(o.omr), tzs(o.tzs), LBL[o.st] || o.st]; }),
        styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2.2, textColor: [15, 42, 28] },
        headStyles: { fillColor: [31, 122, 50], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [244, 246, 242] },
        columnStyles: { 4: { halign: 'right' }, 5: { halign: 'right' } },
        didParseCell: function (d) { if (d.section === 'body' && d.column.index === 6) { var v = d.cell.raw; d.cell.styles.textColor = v === 'Imelipwa' ? [23, 96, 42] : (v === 'Haijaonekana' || v === 'Imeghairiwa' || v === 'Imesitishwa') ? [180, 35, 24] : [138, 90, 11]; } }
      });
      pdfFoot(doc, W, H);
      var b64 = doc.output('datauristring').split(',')[1];
      return shareFile('WakalaOnline-Taarifa-' + label.replace(/\s+/g, '-') + '.pdf', b64, 'application/pdf', 'Taarifa ya miamala · WakalaOnline · ' + label);
    }).catch(shareErr).then(function () { busy(btn, false); });
  }
  function monthName(d) { return ['Januari', 'Februari', 'Machi', 'Aprili', 'Mei', 'Juni', 'Julai', 'Agosti', 'Septemba', 'Oktoba', 'Novemba', 'Desemba'][d.getMonth()] + ' ' + d.getFullYear(); }


  /* ---------- historia ---------- */
  function drawHist() {
    var me = S.me || {};
    $('hiMonth').textContent = omr(me.sentMonth || 0) + ' OMR';
    var b = Number(me.bal) || 0, showBal = Math.abs(b) > 0.0005 || !!me.canAmana;   // mteja mpya asiye na deni/amana haoni salio kabisa
    $('hiBalCard').style.display = showBal ? 'flex' : 'none'; $('hiBalCard').parentNode.style.gridTemplateColumns = showBal ? '' : '1fr';
    $('hiBalLbl').textContent = b < 0 ? 'Deni lako' : 'Salio lako'; $('hiPay').style.display = b < -0.0005 || (S.me && S.me.canAmana) ? 'flex' : 'none'; $('hiPay').textContent = b < -0.0005 ? '💳 Lipa deni' : '➕ Weka amana'; $('hiPay').style.borderColor = $('hiPay').style.color = b < -0.0005 ? 'var(--bad)' : '';
    $('hiBal').textContent = omr(Math.abs(b)) + ' OMR';
    $('hiBal').style.color = b < 0 ? 'var(--bad)' : '';
    document.querySelectorAll('#hiFilt button').forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-f') === S.filt); });
    var L = S.orders.filter(function (o) { return S.filt === 'all' || (S.filt === 'open' ? (o.st === 'new' || o.st === 'ok' || o.st === 'hold' || o.st === 'part') : o.st === 'paid'); });
    $('hiList').innerHTML = L.length ? L.map(function (o) {
      return '<button class="li" data-ref="' + esc(o.ref) + '"><span class="avs">' + esc(initials(o.rn)) + '</span>'
        + '<span style="flex:1;display:flex;flex-direction:column;gap:2px;min-width:0"><span style="font-weight:800;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(o.rn || 'Mpokeaji') + '</span>'
        + '<span class="mut" style="font-size:12px">' + esc(o.ref) + ' · ' + esc(when(o.at)) + (o.net ? ' · ' + esc(o.net) : '') + '</span></span>'
        + '<span style="display:flex;flex-direction:column;align-items:flex-end;gap:4px"><span class="num" style="font-weight:600;font-size:14px">' + omr(o.omr) + ' OMR</span>' + pill(o) + '</span></button>';
    }).join('') : '<div class="empty">Bado hakuna miamala hapa.<br>Bonyeza <b>Tuma</b> kuanza.</div>';
  }
  document.querySelectorAll('[data-st]').forEach(function (b) { b.onclick = function () { statementPdf(b.getAttribute('data-st'), b); }; });
  $('hiFilt').onclick = function (e) { var b = e.target.closest('[data-f]'); if (!b) return; S.filt = b.getAttribute('data-f'); drawHist(); };
  $('hiList').onclick = function (e) { var b = e.target.closest('[data-ref]'); if (b && b.getAttribute('data-ref') !== '—') openTrack(b.getAttribute('data-ref')); };

  /* ---------- kitabu cha wapokeaji: tafuta, ⭐ vipendwa, chagua mmoja au wengi ---------- */
  function recKey(rp) { return String(rp || '').replace(/\W/g, '').toLowerCase(); }
  function ago(t) {
    if (!t) return ''; var d0 = new Date(); d0.setHours(0, 0, 0, 0); var d = new Date(t); d.setHours(0, 0, 0, 0);
    var n = Math.round((d0 - d) / 864e5); return n <= 0 ? 'leo' : n === 1 ? 'jana' : n < 30 ? 'siku ' + n + ' zilizopita' : n < 365 ? 'miezi ' + Math.floor(n / 30) + ' iliyopita' : 'zamani';
  }
  var PK = { mode: 'one', sel: {}, cb: null, skip: {} };
  function openBook(mode, cb, skip) {
    PK.mode = mode; PK.cb = cb; PK.sel = {}; PK.skip = skip || {};
    $('pkQ').value = ''; $('pkT').textContent = mode === 'multi' ? 'Chagua wapokeaji' : 'Kitabu cha wapokeaji';
    pkDraw(); $('pk').classList.add('on');
  }
  function pkDraw() {
    var all = (S.me && S.me.recipients) || [], q = $('pkQ').value.trim().toLowerCase(), qd = q.replace(/\D/g, '');
    var L = all.filter(function (r) { return !q || String(r.rn).toLowerCase().indexOf(q) >= 0 || (qd.length >= 3 && String(r.rp).replace(/\D/g, '').indexOf(qd) >= 0) || String(r.net || '').toLowerCase().indexOf(q) >= 0; });
    $('pkHint').textContent = q ? L.length + ' kati ya ' + all.length : 'Wapokeaji ' + all.length + ' · ⭐ = kipendwa (kinakaa juu)' + (PK.mode === 'multi' ? ' · gusa kuchagua wengi' : '');
    $('pkList').innerHTML = L.length ? L.map(function (r) {
      var k = recKey(r.rp), on = !!PK.sel[k], had = !!PK.skip[k];
      return '<div class="pki' + (on ? ' on' : '') + '" data-pk="' + esc(k) + '" role="button" tabindex="0"' + (had ? ' style="opacity:.55"' : '') + '>'
        + (PK.mode === 'multi' ? '<span class="ck">' + (on ? svg('check', 14, '#fff', 3) : '') + '</span>' : '<span class="avs" style="background:var(--lime-soft)">' + esc(initials(r.rn)) + '</span>')
        + '<span style="flex:1;display:flex;flex-direction:column;gap:2px;min-width:0"><span style="font-weight:800;font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(r.rn) + '</span>'
        + '<span class="mut" style="font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(r.net || '') + ' · ' + esc(r.rp) + '</span>'
        + '<span style="font-size:12px;font-weight:700;color:var(--ok-ink)">' + (had ? 'tayari kwenye orodha' : (r.n ? 'mara ' + r.n : 'mpya') + (r.t ? ' · mwisho ' + ago(r.t) : '')) + '</span></span>'
        + '<button type="button" class="star' + (r.fav ? ' on' : '') + '" data-star="' + esc(k) + '" aria-label="' + (r.fav ? 'Ondoa kipendwa' : 'Weka kipendwa') + ' ' + esc(r.rn) + '">⭐</button></div>';
    }).join('') : '<div class="empty">Hakuna anayelingana na "' + esc(q) + '"</div>';
    var n = Object.keys(PK.sel).length;
    $('pkAdd').style.display = PK.mode === 'multi' ? 'flex' : 'none';
    $('pkAdd').disabled = !n; $('pkAdd').textContent = n ? 'Ongeza (' + n + ')' : 'Chagua wapokeaji';
  }
  function recByKey(k) { return ((S.me && S.me.recipients) || []).filter(function (r) { return recKey(r.rp) === k; })[0]; }
  $('pkQ').addEventListener('input', pkDraw);
  $('pkClose').onclick = function () { $('pk').classList.remove('on'); };
  $('pk').onclick = function (e) { if (e.target === this) this.classList.remove('on'); };
  $('pkList').onclick = function (e) {
    var st = e.target.closest('[data-star]');
    if (st) {
      e.stopPropagation(); var k = st.getAttribute('data-star'), r = recByKey(k); if (!r) return;
      r.fav = r.fav ? 0 : 1; st.classList.toggle('on', !!r.fav); haptic();
      api('w_fav', { rp: r.rp, on: r.fav ? 1 : 0 }).then(function (j) { if (j.ok && j.recipients) { S.me.recipients = j.recipients; setMe(S.me); pkDraw(); } else if (!j.ok) toast(j.msg || 'Imeshindikana'); }).catch(function (x) { toast(x.message); });
      return;
    }
    var it = e.target.closest('[data-pk]'); if (!it) return; var k2 = it.getAttribute('data-pk');
    if (PK.mode === 'multi') { if (PK.skip[k2]) return toast('Yuko tayari kwenye orodha'); if (PK.sel[k2]) delete PK.sel[k2]; else PK.sel[k2] = 1; haptic(); pkDraw(); return; }
    $('pk').classList.remove('on'); var r2 = recByKey(k2); if (r2 && PK.cb) PK.cb(r2);
  };
  $('pkAdd').onclick = function () {
    var list = ((S.me && S.me.recipients) || []).filter(function (r) { return PK.sel[recKey(r.rp)]; });
    $('pk').classList.remove('on'); if (PK.cb) PK.cb(list);
  };

  /* ---------- tuma kwa wengi: orodha ya wapokeaji, malipo moja, risiti moja ---------- */
  var B = { rows: [], proof: '', ck: '' }, BMAX = 25;
  function bMob(rp) { var d = String(rp || '').replace(/\D/g, ''); if (d.indexOf('255') === 0) d = d.slice(3); if (d.charAt(0) === '0') d = d.slice(1); return /^[67]\d{8}$/.test(d) ? '0' + d : ''; }
  function bDetect(x) {
    if (isBill(x.net)) { x.kind = 'bill'; return x; }
    var m = bMob(x.rp);
    x.kind = m ? 'mobile' : 'bank';
    if (!x.manual) x.net = m ? netFor(m) : bankFor(x.rp);
    return x;
  }
  function bLoad() {
    try { var v = JSON.parse(localStorage.getItem('yzw_bulk') || 'null'); if (v && v.rows) B.rows = v.rows; } catch (e) {}
  }
  function bSave() { try { localStorage.setItem('yzw_bulk', JSON.stringify({ rows: B.rows })); } catch (e) {} }
  function openBulk() {
    var i = info() || {};
    if (!B.rows.length) bLoad();
    if (!B.rows.length) B.rows = [{ rn: '', rp: '', omr: '' }];
    B.ck = ''; drawPayInto('bPay', i.payOmr || '');
    var saved = (S.me && S.me.recipients) || [];
    $('bBook').style.display = saved.length ? 'flex' : 'none'; $('bBookN').textContent = 'Wapokeaji ' + saved.length + ' · chagua wengi kwa mara moja';
    $('bErr').textContent = '';
    bDraw(); S.stack.push('bulk'); show('bulk', false);
  }
  $('sBulk').onclick = function () { S.stack.pop(); openBulk(); };
  function bRowHtml(x, k) {
    var i = info() || {}, opts = (x.kind === 'mobile' ? (i.nets || ['Mixx by Yas', 'Vodacom M-Pesa', 'Airtel Money', 'Halopesa', 'TTCL T-Pesa']) : (i.banks || ['CRDB', 'NMB', 'NBC']));
    var showSel = x.rp && (!x.net || x.manual);
    return '<div class="card brow" data-row="' + k + '">'
      + '<div class="bh"><span class="bn">' + (k + 1) + '</span><input class="b-rn" value="' + esc(x.rn || '') + '" placeholder="Jina kamili la mpokeaji" autocomplete="off"><button type="button" class="x" data-del="' + k + '" aria-label="Ondoa mpokeaji ' + (k + 1) + '">×</button></div>'
      + '<div class="two"><input class="b-rp num" value="' + esc(x.rp || '') + '" placeholder="Simu au akaunti" autocomplete="off" autocapitalize="characters"><input class="b-om num" value="' + esc(x.omr || '') + '" placeholder="OMR" inputmode="decimal" style="text-align:right"></div>'
      + '<select class="b-net" style="display:' + (showSel ? 'block' : 'none') + '"><option value="">' + (x.kind === 'mobile' ? 'Chagua mtandao' : 'Chagua benki') + '</option>' + opts.map(function (n) { return '<option' + (n === x.net ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') + '</select>'
      + '<div class="tag"><span class="b-tg"></span><span class="b-tz num"></span></div></div>';
  }
  function bTag(k) {
    var x = B.rows[k], el = document.querySelector('[data-row="' + k + '"]'); if (!el || !x) return;
    var o = Number(String(x.omr || '').replace(/,/g, '')) || 0, r = rateFor(o);
    el.querySelector('.b-tz').textContent = o ? tzs(o * r) + ' TZS' : '';
    var tg = el.querySelector('.b-tg');
    if (!x.rp) tg.textContent = '';
    else if (x.net) tg.innerHTML = '<span style="color:' + (NETC[x.net] || 'var(--brand-2)') + '">●</span> ' + esc(x.net) + (x.manual ? '' : ' · imetambuliwa') + ' <button type="button" data-chg="' + k + '" style="background:none;border:none;color:var(--brand-2);font-weight:800;font-size:12px;cursor:pointer;padding:2px 4px">Badilisha</button>';
    else tg.innerHTML = '<span style="color:var(--warn)">' + (x.kind === 'mobile' ? 'Chagua mtandao' : 'Chagua benki ya akaunti hii') + '</span>';
    el.querySelector('.b-net').style.display = x.rp && (!x.net || x.manual) ? 'block' : 'none';
    el.classList.remove('bad');
  }
  function bTot() {
    var to = 0, tt = 0, n = 0;
    B.rows.forEach(function (x) { var o = Number(String(x.omr || '').replace(/,/g, '')) || 0; if (o) { to += o; tt += o * rateFor(o); n++; } });
    var f = R(), bi = -1; if (f.on && f.bonus) B.rows.some(function (x, k) { if ((Number(x.omr) || 0) >= (f.min || 0)) { bi = k; return true; } });
    var bn = bi >= 0 ? f.bonus : 0;
    $('bTotO').textContent = omr(Math.round(to * 1000) / 1000) + ' OMR'; $('bTotT').textContent = tzs(tt + bn) + ' TZS';
    $('bBonus').style.display = bn ? 'block' : 'none'; if (bn) $('bBonus').textContent = '🎁 Pamoja na zawadi ya rafiki TZS ' + tzs(bn) + ' (kwa mpokeaji wa ' + (bi + 1) + ')';
    $('bCount').textContent = '(' + B.rows.length + ')';
    $('bGo').textContent = n ? 'Endelea — hakiki (' + n + ')' : 'Endelea — hakiki';
    return { omr: to, tzs: tt + bn, n: n, bonus: bn, bi: bi };
  }
  function bDraw() {
    B.rows.forEach(bDetect);
    $('bRows').innerHTML = B.rows.map(bRowHtml).join('');
    B.rows.forEach(function (x, k) { bTag(k); });
    $('bAdd').style.display = B.rows.length >= BMAX ? 'none' : 'flex';
    bTot(); bSave();
  }
  $('bRows').addEventListener('input', function (e) {
    var el = e.target.closest('[data-row]'); if (!el) return; var k = +el.getAttribute('data-row'), x = B.rows[k];
    if (e.target.classList.contains('b-rn')) x.rn = e.target.value;
    if (e.target.classList.contains('b-rp')) { var was = x.kind; x.rp = e.target.value; bDetect(x); if (was !== x.kind) { x.manual = false; bDetect(x); var sel = el.querySelector('.b-net'); var tmp = document.createElement('div'); tmp.innerHTML = bRowHtml(x, k); sel.replaceWith(tmp.querySelector('.b-net')); } }
    if (e.target.classList.contains('b-om')) x.omr = e.target.value;
    bTag(k); bTot(); bSave();
  });
  $('bRows').addEventListener('change', function (e) {
    if (!e.target.classList.contains('b-net')) return;
    var k = +e.target.closest('[data-row]').getAttribute('data-row'); B.rows[k].net = e.target.value; B.rows[k].manual = true; bTag(k); bSave();
  });
  $('bRows').addEventListener('click', function (e) {
    var d = e.target.closest('[data-del]'), c = e.target.closest('[data-chg]');
    if (d) { B.rows.splice(+d.getAttribute('data-del'), 1); if (!B.rows.length) B.rows.push({ rn: '', rp: '', omr: '' }); bDraw(); }
    if (c) { var k = +c.getAttribute('data-chg'); B.rows[k].manual = true; var el = document.querySelector('[data-row="' + k + '"]'); el.querySelector('.b-net').style.display = 'block'; el.querySelector('.b-net').focus(); }
  });
  $('bAdd').onclick = function () { if (B.rows.length >= BMAX) return; B.rows.push({ rn: '', rp: '', omr: '' }); bDraw(); var l = document.querySelectorAll('#bRows .b-rn'); l[l.length - 1].focus(); };
  $('bBook').onclick = function () {
    var have = {}; B.rows.forEach(function (x) { if (x.rp) have[recKey(x.rp)] = 1; });
    openBook('multi', function (list) {
      var add = list.filter(function (r) { return !have[recKey(r.rp)]; });
      B.rows = B.rows.filter(function (x) { return x.rn || x.rp || x.omr; });
      add.forEach(function (r) { if (B.rows.length < BMAX) B.rows.push({ rn: r.rn, rp: r.rp, omr: '', net: r.net, manual: !!r.net && !(bMob(r.rp) ? netFor(bMob(r.rp)) === r.net : bankFor(r.rp) === r.net) }); });
      if (!B.rows.length) B.rows.push({ rn: '', rp: '', omr: '' });
      bDraw(); haptic();
      if (add.length) { toast('✓ Wapokeaji ' + add.length + ' wameongezwa — weka kiasi cha kila mmoja'); var f = Array.prototype.filter.call(document.querySelectorAll('#bRows .b-om'), function (x) { return !x.value; })[0]; if (f) f.focus(); }
    }, have);
  };
  $('bProof').onchange = function () {
    var f = this.files && this.files[0]; if (!f) return; $('bProofTxt').textContent = 'Inaandaa picha…';
    shrink(f, 1600, 0.82).then(function (d) { B.proof = d; $('bProofImg').src = d; $('bProofImg').style.display = 'block'; $('bProofTxt').textContent = '✓ Risiti imewekwa · badilisha'; })
      .catch(function () { B.proof = ''; $('bProofTxt').textContent = 'Picha haikufunguka — jaribu nyingine'; });
  };
  function bBad(k, msg) { $('bErr').textContent = msg; var el = document.querySelector('[data-row="' + k + '"]'); if (el) { el.classList.add('bad'); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } }
  $('bGo').onclick = function () {
    $('bErr').textContent = ''; var i = info() || {}, items = [];
    var rows = B.rows.filter(function (x) { return x.rn || x.rp || x.omr; });
    if (!rows.length) { $('bErr').textContent = 'Ongeza wapokeaji kwanza'; return; }
    for (var k = 0; k < B.rows.length; k++) {
      var x = B.rows[k]; if (!x.rn && !x.rp && !x.omr) continue;
      var o = Math.round((Number(String(x.omr || '').replace(/,/g, '')) || 0) * 1000) / 1000, n = 'Mpokeaji wa ' + (k + 1) + ': ';
      if (String(x.rn || '').trim().length < 3) return bBad(k, n + 'weka jina kamili');
      if (!x.rp) return bBad(k, n + 'weka namba ya simu au akaunti');
      if (!x.net) return bBad(k, n + (x.kind === 'mobile' ? 'chagua mtandao' : 'chagua benki'));
      if (!(o >= (i.min || 1))) return bBad(k, n + 'weka kiasi cha OMR');
      var r = rateFor(o);
      if (x.kind === 'bank' && o > (i.maxBank || 10000)) return bBad(k, n + 'kwa benki, kiasi cha juu ni ' + omr(i.maxBank || 10000) + ' OMR');
      if (x.kind === 'mobile' && o * r > (i.maxMob || 5000000)) return bBad(k, n + 'kwa pesa ya simu, kiasi cha juu ni ' + tzs(i.maxMob || 5000000) + ' TZS (≈ ' + omr(Math.floor((i.maxMob || 5000000) / r)) + ' OMR)');
      items.push({ rn: String(x.rn).trim(), rp: x.kind === 'mobile' ? bMob(x.rp) : String(x.rp).replace(/[\s-]/g, '').toUpperCase(), net: x.net, kind: x.kind, omr: o, rate: r });
    }
    if (!B.proof) { $('bErr').textContent = 'Pakia picha ya risiti ya malipo ya jumla kwanza'; return; }
    if (!B.ck) B.ck = 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    bReview({ items: items, img: B.proof, ck: B.ck });
  };
  function bReview(body) {
    var T = bTot();
    $('cfT').textContent = 'Hakiki — wapokeaji ' + body.items.length;
    $('cfAmt').textContent = omr(Math.round(T.omr * 1000) / 1000) + ' OMR'; $('cfTzs').textContent = tzs(T.tzs) + ' TZS';
    $('cfRows').innerHTML = body.items.map(function (x, k) {
      return '<div class="row" style="justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--line);align-items:flex-start"><span style="display:flex;flex-direction:column;gap:2px;min-width:0"><b style="font-size:14px">' + (k + 1) + '. ' + esc(String(x.rn).toUpperCase()) + '</b><span class="mut" style="font-size:12px">' + esc(x.net) + ' · ' + esc(x.rp) + '</span></span>'
        + '<span style="display:flex;flex-direction:column;align-items:flex-end;gap:2px;flex:none"><b class="num">' + omr(x.omr) + ' OMR</b><span class="mut num" style="font-size:12px">' + tzs(x.omr * x.rate + (k === T.bi ? T.bonus : 0)) + ' TZS' + (k === T.bi ? ' 🎁' : '') + '</span></span></div>';
    }).join('');
    $('cfImg').src = body.img; $('cfImg').parentNode.style.display = 'flex';
    var cf = $('cf'); cf.classList.add('on'); $('cfErr').textContent = '';
    $('cfNo').onclick = function () { cf.classList.remove('on'); $('cfT').textContent = 'Hakiki oda yako'; };
    $('cfGo').onclick = function () { bSubmit(body, this); };
  }
  function bSubmit(body, btn) {
    var err = $('cfErr'); err.textContent = ''; if (btn.disabled) return;
    busy(btn, true, 'Inatuma oda ' + body.items.length + '…');
    api('w_batch', body).then(function (j) {
      busy(btn, false);
      if (!j.ok && j.error === 'twin') { if (confirm(j.msg + '\n\nBonyeza OK kuendelea.')) { body.again = 1; return bSubmit(body, btn); } $('cf').classList.remove('on'); if (j.row != null) bBad(j.row, j.msg); return; }
      if (!j.ok) {
        if (j.error === 'rate') { $('cf').classList.remove('on'); Promise.all([loadInfo(), loadMe()]).then(function () { bDraw(); $('bErr').textContent = j.msg; }); return; }
        if (j.row != null) { $('cf').classList.remove('on'); bBad(j.row, j.msg); return; }
        err.textContent = j.msg || 'Imeshindikana'; return;
      }
      $('cf').classList.remove('on'); $('cfT').textContent = 'Hakiki oda yako';
      B.rows = []; B.proof = ''; B.ck = ''; bSave(); $('bProof').value = ''; $('bProofImg').style.display = 'none'; $('bProofTxt').textContent = 'Pakia picha ya risiti';
      if (!j.dup) { S.orders = (j.orders || []).slice().reverse().concat(S.orders); LS.set('yzw_orders', S.orders); }
      var tot = (j.orders || []).reduce(function (a, o) { return a + (o.tzs || 0); }, 0);
      S.stack = ['home'];
      $('okT').textContent = 'Oda ' + (j.orders || []).length + ' zimepokelewa!';
      $('okAmt').textContent = tzs(tot) + ' TZS';
      $('okTxt').textContent = 'Kundi ' + (j.bt || '') + ' · wapokeaji ' + (j.orders || []).length + '. Tunathibitisha malipo yako sasa — utapata taarifa pesa ikifika kwa kila mmoja.';
      $('okRef').textContent = j.bt || ''; $('ok').classList.add('on'); haptic();
      $('okTrack').textContent = 'Ona oda zote';
      $('okTrack').onclick = function () { $('ok').classList.remove('on'); $('okT').textContent = 'Oda imepokelewa!'; $('okTrack').textContent = 'Fuatilia order'; S.stack = ['hist']; show('hist', false); };
      $('okHome').onclick = function () { $('ok').classList.remove('on'); $('okT').textContent = 'Oda imepokelewa!'; $('okTrack').textContent = 'Fuatilia order'; S.stack = ['home']; show('home', false); };
      loadMe(); loadOrders();
    }).catch(function (e) { busy(btn, false); err.textContent = e.message + ' — oda hazijatumwa, jaribu tena.'; });
  }

  /* ---------- lipa deni ---------- */
  var PD = { proof: '', ck: '' };
  function owe() { var b = Number(S.me && S.me.bal) || 0; return b < -0.0005 ? Math.round(-b * 1000) / 1000 : 0; }
  function pendPays() { return ((S.me && S.me.pays) || []).filter(function (p) { return p.st === 'new'; }); }
  function amana() { var b = Number(S.me && S.me.bal) || 0; return b > 0.0005 ? Math.round(b * 1000) / 1000 : 0; }
  function balAvail() { var a = S.me && S.me.balAvail; return a != null ? Number(a) || 0 : amana(); }
  function drawDebt() {
    var o = owe(), am = amana(), c = $('hDebt'); c.style.display = o || am ? 'flex' : 'none'; if (!o && !am) return;
    var red = !!o; c.style.background = red ? 'var(--bad-soft)' : 'var(--ok-soft)'; c.style.borderColor = red ? '#F3C4BE' : 'transparent';
    $('hDebtL').textContent = red ? 'Deni lako' : '💰 Salio lako (amana)'; $('hDebtL').style.color = $('hDebtAmt').style.color = red ? 'var(--bad)' : 'var(--ok-ink)';
    $('hDebtSub').style.display = red ? 'none' : 'block'; $('hDebtSub').textContent = 'Unaweza kulipia oda kwa salio hili — bila risiti';
    $('hDebtBtn').textContent = red ? '💳 Lipa deni' : '➕ Weka amana zaidi'; $('hDebtBtn').className = red ? 'btn dark' : 'btn ghost';
    $('hDebtAmt').textContent = omr(red ? o : am) + ' OMR';
    var P = pendPays(), ps = P.reduce(function (a, p) { return a + p.omr; }, 0);
    $('hDebtPend').style.display = P.length ? 'inline-flex' : 'none'; $('hDebtPend').textContent = '⏳ ' + omr(ps) + ' OMR inahakikiwa';
  }
  function openPay() {
    var o = owe(), am = amana();
    if (!o && !(S.me && S.me.canAmana)) return toast('Kuweka amana kunahitaji ruhusa ya WakalaOnline — wasiliana nasi WhatsApp');
    var P = pendPays(), ps = Math.round(P.reduce(function (a, p) { return a + p.omr; }, 0) * 1000) / 1000, left = Math.max(0, Math.round((o - ps) * 1000) / 1000);
    $('pdT').textContent = o ? '💳 Lipa deni' : '➕ Weka amana';
    $('pdOweL').textContent = o ? 'Deni lako' : 'Salio lako (amana)'; $('pdOwe').textContent = omr(o || am) + ' OMR';
    $('pdOweBox').style.background = o ? 'var(--bad-soft)' : 'var(--ok-soft)'; $('pdOweL').style.color = $('pdOwe').style.color = o ? 'var(--bad)' : 'var(--ok-ink)';
    $('pdPendBox').innerHTML = P.length ? '<div class="card" style="font-size:13px;display:flex;flex-direction:column;gap:4px"><b>⏳ Malipo yanayohakikiwa</b>' + P.map(function (p) { return '<span class="mut">' + omr(p.omr) + ' OMR · ' + esc(when(p.at)) + '</span>'; }).join('') + '<span class="mut">Deni litapungua yakithibitishwa.</span></div>' : '';
    $('pdAmt').value = left || ''; $('pdErr').textContent = '';
    var ch = left ? [left].concat([5, 10, 20, 50].filter(function (x) { return x < left; })).slice(0, 3).concat([Math.ceil(left / 10) * 10 + 10]) : [20, 50, 100, 200];
    $('pdChips').innerHTML = ch.map(function (x, k) { return '<button type="button" data-pa="' + x + '"' + (k === 0 && left ? ' class="on"' : '') + '>' + (k === 0 && left ? 'Deni lote · ' : '') + omr(x) + '</button>'; }).join('');
    pdHint();
    drawPayInto('pdPay', (info() || {}).payOmr || '');
    PD.ck = ''; $('pd').classList.add('on');
  }
  $('hDebtBtn').onclick = openPay; $('hiPay').onclick = openPay;
  $('pdClose').onclick = function () { $('pd').classList.remove('on'); };
  $('pd').onclick = function (e) { if (e.target === this) this.classList.remove('on'); };
  $('pdChips').onclick = function (e) { var b = e.target.closest('[data-pa]'); if (!b) return; $('pdAmt').value = b.getAttribute('data-pa'); document.querySelectorAll('#pdChips button').forEach(function (x) { x.classList.toggle('on', x === b); }); pdHint(); };
  function pdHint() {
    var a = Number(String($('pdAmt').value).replace(/,/g, '')) || 0, o = owe(), ps = pendPays().reduce(function (x, p) { return x + p.omr; }, 0), left = Math.max(0, o - ps), h = $('pdHint');
    var extra = Math.round((a - left) * 1000) / 1000;
    h.style.display = a > 0 && (extra > 0.0005 || !o) ? 'block' : 'none';
    h.textContent = !o ? '💰 ' + omr(a) + ' OMR zitakuwa amana yako — unaweza kulipia oda bila kutuma risiti tena.' : '✓ Deni litafutwa, na ziada ' + omr(extra) + ' OMR itakuwa amana yako.';
  }
  $('pdAmt').addEventListener('input', pdHint);
  $('pdPay').onclick = function (e) { $('sPay').onclick.call(this, e); };
  $('pdProof').onchange = function () {
    var f = this.files && this.files[0]; if (!f) return; $('pdProofTxt').textContent = 'Inaandaa picha…';
    shrink(f, 1600, 0.82).then(function (d) { PD.proof = d; $('pdProofImg').src = d; $('pdProofImg').style.display = 'block'; $('pdProofTxt').textContent = '✓ Risiti imewekwa · badilisha'; })
      .catch(function () { PD.proof = ''; $('pdProofTxt').textContent = 'Picha haikufunguka — jaribu nyingine'; });
  };
  $('pdGo').onclick = function () {
    var btn = this, a = Math.round((Number(String($('pdAmt').value).replace(/,/g, '')) || 0) * 1000) / 1000, err = $('pdErr'); err.textContent = '';
    if (!(a >= 0.5)) { err.textContent = 'Weka kiasi unacholipa'; return; }
    if (!PD.proof) { err.textContent = 'Pakia picha ya risiti ya malipo yako'; return; }
    if (!PD.ck) PD.ck = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    busy(btn, true, 'Inatuma…');
    api('w_paydebt', { omr: a, img: PD.proof, ck: PD.ck }).then(function (j) {
      busy(btn, false); if (!j.ok) { err.textContent = j.msg || 'Imeshindikana'; return; }
      setMe(j); PD.proof = ''; PD.ck = ''; $('pdProof').value = ''; $('pdProofImg').style.display = 'none'; $('pdProofTxt').textContent = 'Pakia picha ya risiti';
      $('pd').classList.remove('on'); haptic(); toast('✓ Malipo ya ' + omr(a) + ' OMR yametumwa — utapata taarifa yakithibitishwa');
      var on = document.querySelector('.scr.on'); if (on && on.id === 's-home') drawHome(); if (on && on.id === 's-hist') drawHist();
    }).catch(function (e) { busy(btn, false); err.textContent = e.message; });
  };

  /* ---------- mlete rafiki, mfaidike wote ---------- */
  function R() { return (S.me && S.me.ref) || { on: false }; }
  function bonusFor(o) { var f = R(); return f.on && f.bonus && o >= (f.min || 0) ? f.bonus : 0; }
  function drawRefCard() {
    var f = R(), c = $('hRef'); c.style.display = f.on ? 'flex' : 'none'; if (!f.on) return;
    if (f.bonus) { $('hRefT').textContent = '🎉 Una zawadi ya TZS ' + tzs(f.bonus); $('hRefS').textContent = 'Itaongezwa kwenye oda yako ijayo (kuanzia ' + omr(f.min) + ' OMR)'; }
    else if (f.canEnter) { $('hRefT').textContent = 'Umeletwa na rafiki?'; $('hRefS').textContent = 'Weka code yake upate zawadi ya TZS ' + tzs(f.get); }
    else { $('hRefT').textContent = 'Mlete rafiki, mfaidike wote'; $('hRefS').textContent = 'Wewe TZS ' + tzs(f.give) + ' · rafiki yako TZS ' + tzs(f.get); }
  }
  function refMsg() {
    var f = R(), i = info() || {}, link = f.link || ('https://wa.me/' + HELP_WA + '?text=' + encodeURIComponent('Habari WakalaOnline, nimeletwa na rafiki (code ' + f.code + '). Naomba kutuma pesa Tanzania.'));
    return 'Habari! Mimi natuma pesa Tanzania kwa *WakalaOnline* — haraka, salama, na pesa inafika ndani ya dakika.\n'
      + (rateFor(0) ? 'Rate ya leo: 1 OMR = ' + tzs(i.rate || rateFor(0)) + ' TZS.\n' : '')
      + '\n🎁 Jiunge kwa code yangu *' + f.code + '* upate zawadi ya *TZS ' + tzs(f.get) + '* kwenye muamala wako wa kwanza (kuanzia ' + omr(f.min) + ' OMR).\n\n' + link;
  }
  function openRef() {
    var f = R(); if (!f.on) return;
    $('rfHow').innerHTML = 'Rafiki yako akijiunga kwa code yako na kutuma kwa mara ya kwanza, <b>wewe unapata TZS ' + tzs(f.give) + '</b> na <b>yeye anapata TZS ' + tzs(f.get) + '</b> — zinaongezwa kwenye pesa anayopokea mpokeaji.';
    $('rfBonus').innerHTML = f.bonus ? '<div class="card" style="background:var(--lime-soft);border-color:transparent;display:flex;flex-direction:column;gap:4px;text-align:center"><span class="mut" style="font-size:12px;font-weight:700">Zawadi yako sasa</span><b class="num" style="font-size:26px;color:var(--ok-ink)">TZS ' + tzs(f.bonus) + '</b><span style="font-size:13px;font-weight:600">Itaongezwa yenyewe kwenye oda yako ijayo ya ' + omr(f.min) + ' OMR au zaidi</span></div>' : '';
    $('rfEnter').style.display = f.canEnter ? 'flex' : 'none'; $('rfErr').textContent = '';
    $('rfEnterTxt').textContent = 'Weka code ya aliyekuleta kabla ya kutuma mara ya kwanza, upate TZS ' + tzs(f.get) + '.';
    $('rfMine').textContent = f.code;
    $('rfJ').textContent = f.joined || 0; $('rfW').textContent = f.wait || 0; $('rfE').textContent = tzs(f.earned || 0);
    $('rfRules').textContent = (f.by ? 'Uliletwa na ' + f.by + '. ' : '') + 'Zawadi inahesabiwa baada ya oda ya kwanza ya rafiki yako (kuanzia ' + omr(f.min) + ' OMR) kuthibitishwa. Code ni kwa wateja wapya tu. Oda ikikataliwa, zawadi inarudi.';
    $('rf').classList.add('on');
  }
  $('hRef').onclick = openRef;
  $('rfClose').onclick = function () { $('rf').classList.remove('on'); };
  $('rf').onclick = function (e) { if (e.target === this) this.classList.remove('on'); };
  $('rfCopy').onclick = function () { var b = this; copyText(R().code).then(function () { haptic(); b.textContent = 'Imenakiliwa'; toast('✓ Code imenakiliwa'); setTimeout(function () { b.textContent = 'Nakili'; }, 2000); }); };
  $('rfWa').onclick = function () { window.open('https://wa.me/?text=' + encodeURIComponent(refMsg()), '_blank'); };
  $('rfShare').onclick = function () {
    var t = refMsg(), SH = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Share;
    var p = SH ? SH.share({ title: 'WakalaOnline', text: t, dialogTitle: 'Mtumie rafiki' }) : navigator.share ? navigator.share({ title: 'WakalaOnline', text: t }) : copyText(t).then(function () { toast('✓ Ujumbe umenakiliwa — bandika kwa rafiki'); });
    Promise.resolve(p).catch(shareErr);
  };
  $('rfJoin').onclick = function () {
    var btn = this, c = $('rfCode').value.trim(); $('rfErr').textContent = '';
    if (c.length < 4) { $('rfErr').textContent = 'Weka code ya rafiki yako'; return; }
    busy(btn, true, '…');
    api('w_refer', { code: c }).then(function (j) {
      busy(btn, false); if (!j.ok) { $('rfErr').textContent = j.msg || 'Imeshindikana'; return; }
      setMe(j); haptic(); toast(j.msg || '🎁 Zawadi imewekwa'); openRef(); drawHome();
    }).catch(function (e) { busy(btn, false); $('rfErr').textContent = e.message; });
  };

  /* ---------- akaunti ---------- */
  function drawAcct() {
    var me = S.me || {};
    $('aName').value = me.name || '';
    $('aName').disabled = false;
    $('aSave').style.display = 'flex';
    $('aNameNote').textContent = me.known ? 'Jina hili linaonekana kwenye oda na risiti zako. Ukilibadilisha, linabadilika pia kwenye daftari la WakalaOnline.' : 'Jina hili linaonekana kwenye oda zako.';
    $('aPhone').textContent = me.phone ? '+' + me.phone : '';
    $('aNameTop').textContent = me.name || 'Mteja wa WakalaOnline'; $('aAv').textContent = initials(me.name || 'W');
    $('aHelp').href = 'https://wa.me/' + HELP_WA;
  }
  $('aSave').onclick = function () {
    var btn = this; busy(btn, true, 'Inahifadhi…');
    api('w_name', { name: $('aName').value }).then(function (j) {
      busy(btn, false); if (!j.ok) return toast(j.msg || 'Imeshindikana');
      S.me.name = j.name; setMe(S.me); drawAcct(); toast(j.prev && j.prev !== j.name ? '✓ Jina limebadilishwa — ' + j.prev + ' → ' + j.name : '✓ Jina limehifadhiwa');
      api('w_me', {}).then(function (m) { if (m && m.ok) { S.me = m; setMe(m); drawAcct(); } }).catch(function () {});
    }).catch(function (e) { busy(btn, false); toast(e.message); });
  };
  $('aOut').onclick = function () { if (confirm('Unataka kutoka kwenye app?')) logout(); };

  /* ---------- matangazo ya WakalaOnline (mmiliki anatuma kutoka Daftari) ---------- */
  function newsAgo(t) { var m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'sasa hivi' : m < 60 ? 'dakika ' + m + ' zilizopita' : m < 1440 ? 'saa ' + Math.round(m / 60) + ' zilizopita' : new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); }
  function drawNews() {
    var N = (S.me && S.me.news) || [], c = $('hNews'), x = N[0], seen = LS.get('yzw_newsx', '');
    if (!x || seen === x.id) { c.style.display = 'none'; return; }
    c.style.display = 'flex'; $('hNewsT').textContent = x.t; $('hNewsB').textContent = x.b; $('hNewsAt').textContent = newsAgo(x.at);
    $('hNewsAll').textContent = N.length > 1 ? 'Yote (' + N.length + ')' : ''; $('hNewsAll').style.display = N.length > 1 ? '' : 'none';
  }
  function openNews(id) {
    var N = (S.me && S.me.news) || [];
    $('nwList').innerHTML = N.length ? N.map(function (x) {
      return '<div class="card" style="display:flex;flex-direction:column;gap:4px' + (x.id === id ? ';border-color:#1D4ED8' : '') + '"><b style="font-size:15px">' + esc(x.t) + '</b><div style="font-size:14px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere">' + esc(x.b) + '</div><div class="mut" style="font-size:11px;font-weight:600">' + newsAgo(x.at) + '</div></div>';
    }).join('') : '<div class="mut" style="text-align:center">Hakuna tangazo kwa sasa</div>';
    $('nw').classList.add('on');
  }
  $('hNewsX').onclick = function () { var N = (S.me && S.me.news) || []; if (N[0]) LS.set('yzw_newsx', N[0].id); drawNews(); };
  $('hNewsAll').onclick = function () { openNews(''); };
  $('hNewsB').onclick = $('hNewsT').onclick = function () { var N = (S.me && S.me.news) || []; if (N.length > 1) openNews(N[0].id); };
  $('nwClose').onclick = function () { $('nw').classList.remove('on'); };
  $('nw').onclick = function (e) { if (e.target.id === 'nw') $('nw').classList.remove('on'); };

  /* ---------- taarifa za simu (Firebase) ---------- */
  var pushReady = false;
  function pushInit() {
    var P = window.YZ_PUSH && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.PushNotifications;
    if (!P || pushReady || !S.wt) return; pushReady = true;
    try {
      P.createChannel && P.createChannel({ id: 'yz_wateja', name: 'Oda zangu', description: 'Hali ya oda na risiti', importance: 5, visibility: 0, vibration: true }).catch(function () {});
      P.addListener('registration', function (t) {
        if (t && t.value && LS.get('yzw_push', '') !== t.value + '|' + (S.me && S.me.phone)) api('w_push', { tok: t.value }).then(function (j) { if (j.ok) LS.set('yzw_push', t.value + '|' + (S.me && S.me.phone)); });
      });
      P.addListener('pushNotificationReceived', function (n) {
        if (n && n.data && n.data.news) { loadMe().then(function () { var on = document.querySelector('.scr.on'); if (on && on.id === 's-home') drawHome(); toast('📣 ' + (n.title || 'Tangazo')); }); return; }
        toast((n.title || 'WakalaOnline') + (n.body ? ' — ' + n.body : '')); loadOrders().then(function () { var on = document.querySelector('.scr.on'); if (on && on.id === 's-home') drawHome(); if (on && on.id === 's-track') drawTrack(); }); });
      P.addListener('pushNotificationActionPerformed', function (a) {
        var ref = a && a.notification && a.notification.data && a.notification.data.ref, nid = a && a.notification && a.notification.data && a.notification.data.news;
        if (nid) { loadMe().then(function () { if (!S.wt) return; S.stack = ['home']; show('home', false); drawHome(); openNews(nid); }); return; }
        loadOrders().then(function () { if (ref && S.wt) { S.stack = ['home']; openTrack(ref); } });
      });
      P.checkPermissions().then(function (p) { return p.receive === 'granted' ? p : P.requestPermissions(); })
        .then(function (p) { if (p.receive === 'granted') P.register(); }).catch(function () {});
    } catch (e) {}
  }

  /* ---------- kuanza ---------- */
  var lp = LS.get('yzw_lastphone', null); if (lp) { $('lgCc').value = lp.cc; $('lgPhone').value = lp.raw; }
  function drawLoginRate() { var i = S.info, el = $('loginRate'); if (i && i.rate) { el.style.display = 'inline-flex'; el.querySelector('span').textContent = 'Rate ya sasa: 1 OMR = ' + tzs(i.rate) + ' TZS'; } }
  if (S.wt) {
    S.stack = ['home']; show('home', false);
    Promise.all([loadMe(), loadOrders()]).then(function () { if (S.wt) drawHome(); pushInit(); });
  } else {
    S.stack = ['login']; show('login', false); drawLoginRate(); loadInfo().then(drawLoginRate);
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden && S.wt) Promise.all([loadInfo(), loadOrders()]).then(function () { var on = document.querySelector('.scr.on'); if (on && on.id === 's-home') drawHome(); if (on && on.id === 's-track') drawTrack(); }); });
})();
