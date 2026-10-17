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
            rec: null, kind: 'mobile', proof: '', stack: [], cur: null, filt: 'all', mon: '', poll: 0 };

  /* ---------- seva ---------- */
  function server() { return String(window.YZ_SERVER || '').trim(); }
  function api(action, body, opts) {
    var url = server();
    if (!url) return Promise.reject(new Error('App haijawekwa sawa — wasiliana nasi WhatsApp'));
    var payload = Object.assign({ action: action }, body || {}); if (S.wt) payload.wt = S.wt;
    var parse = function (t) { var j; try { j = JSON.parse(t); } catch (e) { throw new Error('Hatukupata jibu — jaribu tena'); } if (j && j.error === 'login') { logout(true); throw new Error('Ingia tena'); } return j; };
    /* muda wa kusubiri: sekunde 45 kwa maombi ya kawaida, dakika 4 kwa upakiaji wa risiti — badala ya kusubiri bila kikomo */
    var ac = window.AbortController ? new AbortController() : null, tmo = setTimeout(function () { if (ac) ac.abort(); }, opts && opts.progress ? 240000 : 45000);
    var netErr = function (e) { clearTimeout(tmo); throw new Error(e && e.name === 'AbortError' ? 'Mtandao ni wa polepole sana — jaribu tena' : 'Hakuna mtandao. Angalia intaneti yako'); };
    var fo = function (data) { return { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: data, redirect: 'follow', signal: ac ? ac.signal : undefined }; };
    if (opts && opts.progress) {   // asilimia inakadiriwa (Apps Script haikubali preflight ya XHR upload); seva ikijibu → 100%
      var data = JSON.stringify(payload), est = 600 + data.length / 120, t0 = Date.now();
      var id = setInterval(function () { opts.progress(Math.min(0.92, (Date.now() - t0) / est)); }, 80);
      return fetch(url, fo(data))
        .then(function (r) { clearInterval(id); clearTimeout(tmo); opts.progress(1); return r.text(); }, function (e) { clearInterval(id); netErr(e); })
        .then(parse);
    }
    return fetch(url, fo(JSON.stringify(payload)))
      .then(function (r) { clearTimeout(tmo); return r.text(); }, netErr)
      .then(parse);
  }

  /* ---------- kipakia cha kidigitali: nembo ya W inajichora, pete ya asilimia, na namba ---------- */
  var LOAD = { on: false, t: 0 };
  function loadUi() {
    var el = $('yzLoad'); if (el) return el;
    el = document.createElement('div'); el.id = 'yzLoad';
    el.innerHTML = '<div class="yzl-box"><div class="yzl-ring"><svg viewBox="0 0 120 120" class="yzl-svg"><circle class="yzl-bg" cx="60" cy="60" r="54"/><circle class="yzl-arc" cx="60" cy="60" r="54" id="yzlArc"/></svg>'
      + '<svg viewBox="0 0 100 100" class="yzl-mark" aria-hidden="true"><defs><linearGradient id="ymG" x1="15" y1="73" x2="83" y2="24" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#5BBF6E"/><stop offset=".55" stop-color="#B5E04F"/><stop offset="1" stop-color="#EAFFB3"/></linearGradient><filter id="ymBlur" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="3"/></filter></defs>'
      + '<g transform="translate(50 50) skewX(-8) translate(-50 -50)"><path class="ym-glow" d="M15 31 L30 73 L47.5 46 L64 73 L83 24 M68.6 34 L83 24 L86.9 41.1"/><path class="ym-g2" d="M50 73 L69 24" pathLength="100"/><path class="ym-g1" d="M57 73 L76 24" pathLength="100"/><path class="ym-w" d="M15 31 L30 73 L47.5 46 L64 73" pathLength="100"/><path class="ym-rise" d="M64 73 L83 24" pathLength="100"/><path class="ym-head" d="M68.6 34 L83 24 L86.9 41.1" pathLength="100"/></g></svg>'
      + '<div class="yzl-pct" id="yzlPct">0%</div></div><div class="yzl-lbl" id="yzlLbl"></div><div class="yzl-sub" id="yzlSub"></div><div class="yzl-bits" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div></div>';
    document.body.appendChild(el); return el;
  }
  function loadShow(label, sub) { var el = loadUi(); LOAD.on = true; LOAD.t = Date.now(); $('yzlLbl').textContent = label || 'Inatuma…'; $('yzlSub').textContent = sub || ''; loadSet(0); el.classList.add('on'); el.classList.remove('done'); }
  function loadSet(p, sub) { var pct = Math.max(0, Math.min(100, Math.round(p * 100))), arc = $('yzlArc'), C = 2 * Math.PI * 54;
    if (arc) { arc.style.strokeDasharray = C; arc.style.strokeDashoffset = C * (1 - pct / 100); } var t = $('yzlPct'); if (t) t.textContent = pct + '%';
    var el = $('yzLoad'); if (el) el.classList.toggle('wait', pct >= 100); if (sub != null) $('yzlSub').textContent = sub; }
  function loadDone(okMsg) { var el = $('yzLoad'); if (!el) return; LOAD.on = false;
    if (okMsg) { loadSet(1); $('yzlLbl').textContent = okMsg; el.classList.add('done'); el.classList.remove('wait'); setTimeout(function () { el.classList.remove('on', 'done'); }, 700); }
    else el.classList.remove('on', 'wait', 'done'); }
  /* tuma kwa seva ukionyesha asilimia: label (mf. "Inatuma oda…"); baada ya upakiaji 100% → "Inathibitisha…" mpaka seva ijibu */
  function apiLoad(action, body, label, okMsg) {
    loadShow(label, 'Inapakia risiti na taarifa…');
    return api(action, body, { progress: function (p) { loadSet(p * 0.98, p >= 0.98 ? 'Inathibitisha…' : 'Inapakia risiti na taarifa…'); } })
      .then(function (j) { if (j && j.ok !== false) loadDone(okMsg || '✓ Imekamilika'); else loadDone(); return j; }, function (e) { loadDone(); throw e; });
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
  var WSPIN = '<svg class="wspin" viewBox="0 0 100 100" aria-hidden="true"><circle class="ws-ring" cx="50" cy="50" r="44"/><g transform="translate(50 50) skewX(-8) scale(.8) translate(-51 -48.5)"><path class="ws-w" d="M15 31 L30 73 L47.5 46 L64 73"/><path class="ws-a" d="M64 73 L83 24 M68.6 34 L83 24 L86.9 41.1" pathLength="100"/></g></svg>';
  function busy(btn, on, label) {
    if (on) { btn._l = btn.innerHTML; btn.disabled = true; btn.innerHTML = WSPIN + (label || 'Subiri…'); }
    else { btn.disabled = false; if (btn._l) btn.innerHTML = btn._l; }
  }
  function info() { return (S.me && S.me.info) || S.info || null; }
  /* ---------- karatasi ya kuuliza (badala ya confirm() ya kivinjari): Promise<boolean> ---------- */
  var ASK = { close: null };
  function ask(o) {
    o = o || {};
    return new Promise(function (res) {
      var d = $('ask');
      if (!d) { d = document.createElement('div'); d.id = 'ask'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); document.body.appendChild(d); watchDlg(d); }
      d.innerHTML = '<div class="cfs" style="gap:12px"><div style="width:44px;height:5px;border-radius:3px;background:var(--line);margin:0 auto 2px"></div>'
        + (o.icon ? '<div style="font-size:40px;text-align:center;line-height:1" aria-hidden="true">' + o.icon + '</div>' : '')
        + '<h2 style="margin:0;font-family:Sora,sans-serif;font-size:20px;font-weight:600;text-align:center">' + esc(o.title || 'Una uhakika?') + '</h2>'
        + (o.text ? '<div class="mut" style="font-size:14.5px;line-height:1.55;text-align:center;white-space:pre-wrap">' + esc(o.text) + '</div>' : '')
        + '<button class="btn" id="askOk"' + (o.danger ? ' style="background:var(--bad);color:#fff;box-shadow:none"' : '') + '>' + esc(o.ok || 'Ndiyo') + '</button>'
        + '<button class="btn ghost" id="askNo">' + esc(o.no || 'Hapana') + '</button></div>';
      d.style.display = 'flex';
      var done = function (v) { d.style.display = 'none'; ASK.close = null; res(v); };
      $('askOk').onclick = function () { haptic(); done(true); };
      $('askNo').onclick = function () { done(false); };
      d.onclick = function (e) { if (e.target === d) done(false); };
      ASK.close = function () { done(false); };
    });
  }
  /* kosa la fomu: andika, sogeza skrini kwenye ujumbe, na tikisa kisanduku husika */
  function fail(errEl, msg, el) {
    errEl.textContent = msg; haptic();
    try { errEl.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {}
    if (el) setTimeout(function () { try { el.focus({ preventScroll: true }); } catch (e) { try { el.focus(); } catch (e2) {} } el.classList.add('shake'); setTimeout(function () { el.classList.remove('shake'); }, 500); }, 260);
  }
  /* tarakimu za TZS zinaandikwa na koma mara moja: 1000000 → 1,000,000 */
  function liveTzs(inp) { var raw = String(inp.value || '').replace(/\D/g, ''); var v = raw ? Number(raw).toLocaleString('en-US') : ''; if (inp.value !== v) inp.value = v; }
  /* namba ya simu ya Tanzania: 0754 123 456 (nafasi za kusoma tu — zinaondolewa kabla ya kutuma) */
  function livePhone(inp) { var d = String(inp.value || '').replace(/\D/g, ''); if (d.charAt(0) !== '0' || d.length > 10) return; var v = d.length > 7 ? d.slice(0, 4) + ' ' + d.slice(4, 7) + ' ' + d.slice(7) : d.length > 4 ? d.slice(0, 4) + ' ' + d.slice(4) : d; if (inp.value !== v) inp.value = v; }
  /* kitufe cha "Rudi" cha Android: kinafunga karatasi iliyo wazi (hakiki, kitabu, deni, rafiki, risiti…) kabla ya kurudi skrini nyuma */
  var DLGS = ['ask', 'sh', 'stx', 'up', 'nw', 'rv', 'pk', 'pd', 'rf', 'cf', 'ok'], BACKING = false;
  function dlgOpen(d) { return !!d && (d.classList.contains('on') || d.style.display === 'flex'); }
  function closeTop() {
    for (var k = 0; k < DLGS.length; k++) {
      var d = $(DLGS[k]); if (!dlgOpen(d)) continue;
      if (DLGS[k] === 'ask') { if (ASK.close) ASK.close(); else d.style.display = 'none'; }
      else if (DLGS[k] === 'ok') { d.classList.remove('on'); S.stack = ['home']; show('home', false); }
      else { d.classList.remove('on'); if (d.style.display === 'flex') d.style.display = 'none'; }
      return true;
    }
    return false;
  }
  function watchDlg(d) {   // karatasi ikifunguka → ingizo la historia, ili "Rudi" iifunge
    if (!d || d._w || !window.MutationObserver) return; d._w = true; var was = dlgOpen(d);
    new MutationObserver(function () { var now = dlgOpen(d); if (now && !was && history.state !== 'dlg') { try { history.pushState('dlg', ''); } catch (e) {} }
      else if (!now && was && history.state === 'dlg' && !BACKING) { BACKING = true; try { history.back(); } catch (e) {} setTimeout(function () { BACKING = false; }, 300); } was = now; }).observe(d, { attributes: true, attributeFilter: ['class', 'style'] });
  }
  DLGS.forEach(function (id) { watchDlg($(id)); });
  /* ada ya kutuma (TZS) — kutoka Daftari → Kanuni. sell = OMR→TZS (inakatwa kwenye TZS za mpokeaji) · rev = TZS→OMR (inatolewa kwenye TZS unazolipa) */
  function feeFor(d, o) {
    var i = info(), F = i && i.fees && i.fees[d]; if (!F || F.on !== true || !(o > 0)) return 0;
    var T = (F.t || []).filter(function (x) { return Number(x.fee) > 0; }).slice().sort(function (a, b) { return (Number(a.to) || Infinity) - (Number(b.to) || Infinity); });
    for (var k = 0; k < T.length; k++) if (!(Number(T[k].to) > 0) || o <= Number(T[k].to) + 1e-9) return Math.round(Number(T[k].fee));
    return T.length ? Math.round(Number(T[T.length - 1].fee)) : 0;
  }
  function netT(o) { return Math.max(0, Math.round(o * rateFor(o)) - feeFor('sell', o)); }   // TZS atakazopokea mpokeaji (baada ya ada)
  function rvOmr(v, r) { if (!(r > 0) || !(v > 0)) return 0; var f = feeFor('rev', v / r), o = Math.round(Math.max(0, v - f) / r * 1000) / 1000, f2 = feeFor('rev', o); if (f2 !== f) o = Math.round(Math.max(0, v - f2) / r * 1000) / 1000; return o; }
  function feeTxt(f) { return f ? ' · ada TZS ' + tzs(f) : ''; }
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
  var TAB_LAST = 0;
  function tabSlide(id) {   // kidonge kinaanzia tab iliyotangulia, kisha kinateleza
    var n = document.querySelector('#s-' + id + ' nav.tabs'); if (!n) return;
    var to = Number(n.getAttribute('data-ti')) || 0, ind = n.querySelector('.tind'); if (!ind) return;
    ind.style.transition = 'none'; n.style.setProperty('--ti', TAB_LAST); void ind.offsetWidth;
    ind.style.transition = ''; requestAnimationFrame(function () { n.style.setProperty('--ti', to); });
    var b = n.querySelector('button.on svg'); if (b) { b.style.animation = 'none'; void b.offsetWidth; b.style.animation = ''; }
    TAB_LAST = to;
  }
  function show(id, push) {
    S.reveal = false; setTimeout(function () { tabSlide(id); }, 0);
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
  window.addEventListener('popstate', function () {
    var cur = S.stack[S.stack.length - 1];
    if (BACKING) return;   // tulirudisha historia wenyewe baada ya karatasi kufungwa kwa kitufe
    if (closeTop()) { cur = S.stack[S.stack.length - 1]; if (history.state !== cur) { try { history.pushState(cur, ''); } catch (e) {} } return; }
    if (history.state === 'dlg') { try { history.back(); } catch (e) {} return; }   // ingizo la karatasi iliyoshafungwa — liruke
    if (history.state === cur) return;
    if (S.stack.length > 1) back();
  });
  document.addEventListener('backbutton', function () { if (S.stack.length > 1) back(); }, false);
  document.querySelectorAll('[data-back]').forEach(function (b) { b.onclick = back; });
  document.querySelectorAll('nav.tabs').forEach(function (n) {
    var on = n.getAttribute('data-tab');
    var tabs = [['home', 'Nyumbani', 'home'], ['send', 'Tuma', 'send'], ['hist', 'Historia', 'hist'], ['acct', 'Akaunti', 'acct']];
    var idx = tabs.map(function (t) { return t[0]; }).indexOf(on);
    n.innerHTML = '<span class="tind" aria-hidden="true"></span>' + tabs.map(function (t) { return '<button data-go="' + t[0] + '" class="' + (t[0] === on ? 'on' : '') + '"' + (t[0] === on ? ' aria-current="page"' : '') + '>' + svg(t[2]) + t[1] + '</button>'; }).join('');
    n.setAttribute('data-ti', idx); n.style.setProperty('--ti', idx);
    n.onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return; var go = b.getAttribute('data-go');
      if (go === 'send') { var on = document.querySelector('.scr.on'); if (on && on.id === 's-send') return; return openSend(null); }
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
    S.wt = ''; S.me = null; S.orders = []; pushReady = false; ['yzw_t', 'yzw_me', 'yzw_orders', 'yzw_push', 'yzw_draft', 'yzw_draft_pf', 'yzw_rvdraft', 'yzw_bulk'].forEach(LS.del);
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
  // Link ya Drive → link ya moja kwa moja (faili lenyewe, bila ukurasa wa Drive wala redirect) — mteja anaona pete ya asilimia tu
  function dlUrl(u) { var m = /drive\.google\.com\/uc\?(?:.*&)?id=([\w-]+)/.exec(String(u || '')); return m ? 'https://drive.usercontent.google.com/download?id=' + m[1] + '&export=download&confirm=t' : String(u || ''); }
  function showUpdate() {
    var i = (S.me && S.me.info) || S.info || {};
    $('upTxt').innerHTML = 'Toleo <b>1.' + (Number(i.appVer) || '') + '</b> liko tayari (wewe una 1.' + (Number(window.YZ_VER) || '') + '). Pakua upate maboresho mapya.';
    $('upNotes').style.display = i.appNotes ? 'block' : 'none'; $('upNotes').textContent = i.appNotes ? '✨ ' + i.appNotes : '';
    $('up').classList.add('on');
  }
  $('upGo').onclick = function () {
    var i = (S.me && S.me.info) || S.info || {}; if (!i.appUrl) return;
    i = Object.assign({}, i, { appUrl: dlUrl(i.appUrl) });
    var C = window.Capacitor && window.Capacitor.Plugins, FS = C && C.Filesystem, FO = C && C.FileOpener;
    if (!FS || !FO) { window.open(i.appUrl, '_blank'); toast('Inapakua kwa Chrome… fungua faili likiisha'); return; }
    $('up').classList.remove('on'); loadShow('Inapakua toleo jipya 1.' + (Number(i.appVer) || '') + '…', 'WakalaOnline.apk');
    // Njia ya 1: kupakua ndani ya app (native — hakuna kivinjari, mteja haoni link ya GitHub). Njia ya 2 (XHR) ni akiba tu.
    if (typeof FS.downloadFile === 'function') {
      var lis = null;
      try { lis = FS.addListener('progress', function (ev) { if (ev && ev.contentLength > 0) loadSet(ev.bytes / ev.contentLength, Math.round(ev.bytes / 1048576 * 10) / 10 + ' / ' + Math.round(ev.contentLength / 1048576 * 10) / 10 + ' MB'); }); } catch (_) {}
      var unlis = function () { try { if (lis && lis.then) lis.then(function (h) { h.remove(); }); else if (lis && lis.remove) lis.remove(); } catch (_) {} };
      FS.downloadFile({ url: i.appUrl, path: 'WakalaOnline.apk', directory: 'CACHE', progress: true })
        .then(function (w) { unlis(); return FS.stat({ path: 'WakalaOnline.apk', directory: 'CACHE' }).then(function (st) { if (!(st && st.size > 1000000)) throw new Error('faili si APK'); loadSet(1, 'Inafungua kusakinisha…'); return FO.open({ filePath: w.path, contentType: 'application/vnd.android.package-archive' }); }); })   // ukurasa wa kosa wa Drive si APK
        .then(function () { loadDone('✓ Imepakuliwa — sakinisha'); })
        .catch(function () { unlis(); xhrGet(); });
      return;
    }
    xhrGet();
    function xhrGet() {
    var x = new XMLHttpRequest(); x.open('GET', i.appUrl, true); x.responseType = 'blob';
    x.onprogress = function (ev) { if (ev.lengthComputable) loadSet(ev.loaded / ev.total, Math.round(ev.loaded / 1048576 * 10) / 10 + ' / ' + Math.round(ev.total / 1048576 * 10) / 10 + ' MB'); };
    x.onerror = function () { loadDone(); window.open(i.appUrl, '_blank'); toast('Inapakua kwa Chrome… fungua faili likiisha'); };
    x.onload = function () {
      if (x.status >= 400) return x.onerror();
      loadSet(1, 'Inafungua kusakinisha…');
      var rd = new FileReader(); rd.onload = function () {
        var b64 = String(rd.result).split(',')[1];
        FS.writeFile({ path: 'WakalaOnline.apk', data: b64, directory: 'CACHE' }).then(function (w) { return FO.open({ filePath: w.uri, contentType: 'application/vnd.android.package-archive' }); })
          .then(function () { loadDone('✓ Imepakuliwa — sakinisha'); }).catch(function () { loadDone(); window.open(i.appUrl, '_blank'); toast('Fungua faili lililopakuliwa ulisakinishe'); });
      }; rd.readAsDataURL(x.response);
    };
    x.send();
    }
  };
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
    var hr = $('hRev'); if (hr) { hr.style.display = i && i.revOn && i.rateRev ? 'flex' : 'none'; if (i && i.rateRev) $('hRevRate').textContent = '1 OMR = ' + tzs(i.rateRev) + ' TZS'; }
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
    var act = S.orders.filter(function (o) { return o.st === 'new' || o.st === 'ok' || o.st === 'hold' || o.st === 'part' || o.st === 'rchk' || o.st === 'rpay' || o.st === 'rno'; }).slice(0, 3);
    $('hActive').innerHTML = act.map(function (o) {
      return '<button class="card" data-ref="' + esc(o.ref) + '" style="width:100%;text-align:left;cursor:pointer;display:flex;flex-direction:column;gap:12px;color:var(--ink)">'
        + '<div class="row" style="justify-content:space-between"><span class="row" style="gap:10px;min-width:0"><span class="avs">' + esc(initials(o.rn)) + '</span><span style="display:flex;flex-direction:column;min-width:0"><span style="font-weight:800;font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(o.rn || 'Order') + '</span><span class="mut" style="font-size:12px;font-weight:600">Oda inayoendelea · ' + esc(o.ref) + '</span></span></span>' + pill(o) + '</div>'
        + '<div class="num" style="font-size:18px;font-weight:700">' + tzs(o.tzs) + ' <span style="font-size:13px;color:var(--mut)">TZS</span></div>'
        + '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px">' + [1, 2, 3].map(function (s) { return '<div style="height:6px;border-radius:3px;background:' + (o.step >= s ? 'var(--ok)' : 'var(--line)') + '"></div>'; }).join('') + '</div></button>';
    }).join('');
  }
  function calc() {
    var o = Number(String($('cOmr').value).replace(/,/g, '')) || 0, r = rateFor(o);
    $('cTzs').textContent = r ? tzs(netT(o)) : '—';
    $('cRateTxt').textContent = r ? '1 OMR = ' + tzs(r) + feeTxt(feeFor('sell', o)) : '';
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
  $('hRefresh').onclick = function () { var b = this, old = b.innerHTML; b.disabled = true; b.innerHTML = WSPIN; Promise.all([loadMe(), loadOrders()]).then(function () { b.disabled = false; b.innerHTML = old; drawHome(); toast('Imesasishwa'); }, function () { b.disabled = false; b.innerHTML = old; }); };
  $('hRec').onclick = function (e) { var b = e.target.closest('[data-r]'); if (!b) return; var k = b.getAttribute('data-r'); openSend(k === 'new' ? 'new' : (S.me.recipients || [])[+k]); };
  $('hActive').onclick = function (e) { var b = e.target.closest('[data-ref]'); if (b) openTrack(b.getAttribute('data-ref')); };
  /* majina ya hali — yale yale kwenye kadi, orodha, historia na PDF */
  var PILL = { 'new': ['p-new', 'Tunahakiki malipo'], ok: ['p-ok', 'Inatumwa'], paid: ['p-paid', 'Imefika'], no: ['p-no', 'Malipo hayajaonekana'], stop: ['p-stop', 'Imesitishwa'], returned: ['p-stop', 'Pesa imerudi'], refunded: ['p-paid', 'Umerudishiwa pesa'], used: ['p-paid', 'Imetumika kwenye oda nyingine'],
    rchk: ['p-new', 'Wakala anahakiki TZS'], rno: ['p-no', 'TZS hazijaonekana'], rstop: ['p-stop', 'Imesitishwa'], rpay: ['p-ok', 'Tunakulipa OMR'], rdone: ['p-paid', 'OMR umelipwa'], lost: ['p-stop', 'Pesa haikurudi'], hold: ['p-new', 'Thibitisha jina'], part: ['p-ok', 'Imetumwa sehemu'], cancel: ['p-stop', 'Umeghairi'] };
  function pill(o) {
    var t = PILL[o.st] || ['p-new', o.st];
    return '<span class="pill ' + t[0] + '">' + t[1] + '</span>';
  }

  /* ---------- Nunua Rial (TZS → OMR) ---------- */
  var RV = { proof: '', ck: '', kind: 'mobile', sel: null, picks: [] };   // picks: njia hadi 3 (mmiliki anachagua ya kumlipa)
  function rvKind(k) {
    if (k === 'wallet') k = 'mobile'; RV.kind = k; $('rvkMob').classList.toggle('on', k === 'mobile'); $('rvkBank').classList.toggle('on', k === 'bank');
    var me = S.me || {}; $('rvAccL').textContent = k === 'bank' ? 'Namba ya akaunti ya benki' : 'Namba ya simu ya Oman'; $('rvAcc').placeholder = k === 'bank' ? 'mf. 0311064894420024' : '9XXXXXXX';
    $('rvNetBox').style.display = k === 'mobile' ? 'none' : 'flex'; $('rvNetL').textContent = 'Benki';
    fillSelect($('rvNet'), me.omBanks || ['Bank Muscat', 'Sohar International', 'Ahli Bank', 'Bank Dhofar'], 'Chagua benki');
  }
  function rvDrawSaved() {
    var L = (S.me && S.me.payMethods) || [], box = $('rvSaved');
    RV.picks = RV.picks.filter(function (id) { return L.some(function (m) { return m.id === id; }); }); RV.sel = L.filter(function (m) { return m.id === RV.picks[0]; })[0] || null;
    box.innerHTML = (L.length > 1 ? '<div class="mut" style="font-size:12px;font-weight:700">Chagua hadi njia 3 — tutalipa kwa mojawapo inayopatikana</div>' : '') + L.map(function (m) { var on = RV.picks.indexOf(m.id) >= 0;
      return '<button class="opt' + (on ? ' on' : '') + '" data-pm="' + esc(m.id) + '" style="' + (on ? 'background:var(--lime-soft);border-color:var(--brand)' : '') + '"><span class="avs" aria-hidden="true">' + (m.kind === 'bank' ? '🏦' : '📱') + '</span>'
        + '<span style="flex:1;display:flex;flex-direction:column;gap:2px;min-width:0;text-align:left"><b style="font-size:15px">' + esc(m.name) + '</b><span class="mut" style="font-size:12px;font-weight:600">' + esc(m.bank || '') + ' · ' + esc(m.acc) + '</span></span>'
        + (on ? svg('check', 20, 'var(--ok-ink)', 3) : '') + '<button type="button" class="iconbtn" data-pmdel="' + esc(m.id) + '" aria-label="Futa" style="width:32px;height:32px;margin-left:4px">✕</button></button>'; }).join('');
    if (!L.length) { RV.sel = null; $('rvNew').style.display = 'flex'; } else $('rvNew').style.display = RV.sel ? 'none' : $('rvNew').style.display;
  }
  $('rvSaved').onclick = function (e) {
    var d = e.target.closest('[data-pmdel]'); if (d) { e.stopPropagation(); var id = d.getAttribute('data-pmdel');
      ask({ icon: '🗑', title: 'Futa njia hii ya kupokea OMR?', ok: 'Futa', no: 'Acha', danger: true }).then(function (yes) { if (!yes) return;
        api('w_paymethod', { del: id }).then(function (j) { if (!j.ok) return toast(j.msg || 'Imeshindikana'); S.me.payMethods = j.payMethods || []; setMe(S.me); if (RV.sel && RV.sel.id === id) RV.sel = null; rvDrawSaved(); }).catch(function (x) { toast(x.message); }); }); return; }
    var b = e.target.closest('[data-pm]'); if (!b) return; var m = ((S.me && S.me.payMethods) || []).filter(function (x) { return x.id === b.getAttribute('data-pm'); })[0]; if (!m) return;
    var at = RV.picks.indexOf(m.id); if (at >= 0) RV.picks.splice(at, 1); else { if (RV.picks.length >= 3) return toast('Njia 3 tu kwa oda moja'); RV.picks.push(m.id); }
    if (RV.picks.length) $('rvNew').style.display = 'none'; rvDrawSaved(); haptic(); rvDraftSave();
  };
  $('rvNewBtn').onclick = function () { $('rvNew').style.display = 'flex'; $('rvName').focus(); };
  $('rvkMob').onclick = function () { rvKind('mobile'); }; $('rvkBank').onclick = function () { rvKind('bank'); };
  var RVD_K = 'yzw_rvdraft', rvDraftT = 0;
  function rvDraftSave() { clearTimeout(rvDraftT); rvDraftT = setTimeout(function () { var on = document.querySelector('.scr.on'); if (!on || on.id !== 's-rev') return;
    var d = { at: Date.now(), tzs: $('rvTzs').value, kind: RV.kind, name: $('rvName').value, acc: $('rvAcc').value, net: $('rvNet').value, picks: RV.picks, proof: RV.proof || '' };
    if (!d.tzs && !d.name && !d.acc && !d.proof) return LS.del(RVD_K); LS.set(RVD_K, d); }, 350); }
  function rvDraftClear() { LS.del(RVD_K); }
  function rvDraftRestore() {
    var d = LS.get(RVD_K, null); if (!d || Date.now() - (d.at || 0) > 6 * 36e5) { if (d) rvDraftClear(); return; }
    var L = (S.me && S.me.payMethods) || []; var picks = (d.picks || []).filter(function (id) { return L.some(function (m) { return m.id === id; }); }); if (picks.length) RV.picks = picks;
    rvKind(d.kind || 'mobile'); rvDrawSaved();
    if (d.name || d.acc) { $('rvNew').style.display = 'flex'; $('rvName').value = d.name || ''; $('rvAcc').value = d.acc || ''; if (d.net) $('rvNet').value = d.net; }
    $('rvTzs').value = d.tzs || ''; liveTzs($('rvTzs'));
    if (d.proof) { RV.proof = d.proof; $('rvProofImg').src = d.proof; $('rvProofImg').style.display = 'block'; $('rvProofTxt').textContent = '✓ Risiti imewekwa · badilisha'; }
    $('rvDraft').classList.add('on');
  }
  $('rvDraftX').onclick = function () {
    rvDraftClear(); RV.proof = ''; RV.picks = []; $('rvName').value = ''; $('rvAcc').value = ''; $('rvTzs').value = ''; $('rvProof').value = ''; $('rvProofImg').style.display = 'none'; $('rvProofTxt').textContent = 'Pakia risiti ya malipo ya TZS';
    var L = (S.me && S.me.payMethods) || []; RV.picks = L.length ? [L[0].id] : []; rvDrawSaved(); $('rvNew').style.display = L.length ? 'none' : 'flex'; rvCalc(); $('rvDraft').classList.remove('on'); haptic(); toast('Fomu imesafishwa');
  };
  document.getElementById('s-rev').addEventListener('input', rvDraftSave);
  document.getElementById('s-rev').addEventListener('change', rvDraftSave);
  function openRev() {
    var i = info() || {}; if (!i.revOn || !i.rateRev) return toast('Huduma ya Nunua Rial haipatikani kwa sasa');
    var L = (S.me && S.me.payMethods) || []; RV.picks = L.length ? [L[0].id] : []; rvKind(RV.kind); rvDrawSaved(); $('rvNew').style.display = L.length ? 'none' : 'flex';
    $('rvRate').textContent = 'rate 1 OMR = ' + tzs(i.rateRev) + ' TZS'; $('rvMin').textContent = 'Kiasi cha chini: OMR ' + (i.revMin || 5) + ' (TZS ' + tzs((i.revMin || 5) * i.rateRev) + ')';
    drawPayInto('rvPay', i.payTzs || '—'); $('rvErr').textContent = ''; RV.ck = ''; $('rvDraft').classList.remove('on');
    rvDraftRestore(); rvCalc();
    S.stack.push('rev'); show('rev', false);
  }
  function rvCalc() {
    var i = info() || {}, v = Number(String($('rvTzs').value).replace(/,/g, '')) || 0, r = Number(i.rateRev) || 0;
    try { var vi = $('rvTzs'); vi.style.width = Math.max(3, String(vi.value || '').length + 0.6) + 'ch'; } catch (e) {}
    $('rvOmr').textContent = (r && v ? rvOmr(v, r).toFixed(3) : '0') + ' OMR';
    var fr = r && v ? feeFor('rev', rvOmr(v, r)) : 0; $('rvRate').textContent = r ? 'rate 1 OMR = ' + tzs(r) + ' TZS' + feeTxt(fr) : '';
    document.querySelectorAll('#rvChips button').forEach(function (b) { b.classList.toggle('on', Number(b.getAttribute('data-tz')) === v); });
  }
  $('rvTzs').addEventListener('input', function () { liveTzs(this); rvCalc(); rvDraftSave(); });
  $('rvChips').onclick = function (e) { var b = e.target.closest('[data-tz]'); if (!b) return; $('rvTzs').value = b.getAttribute('data-tz'); liveTzs($('rvTzs')); rvCalc(); rvDraftSave(); haptic(); };
  $('hRev').onclick = function () { haptic(); openRev(); };
  $('rvPay').onclick = function (e) { $('sPay').onclick.call(this, e); };
  $('rvProof').onchange = function () {
    var f = this.files && this.files[0]; if (!f) return; $('rvProofTxt').textContent = 'Inaandaa risiti…';
    shrink(f, 1600, 0.82).then(function (d) { RV.proof = d; $('rvProofImg').src = d; $('rvProofImg').style.display = 'block'; $('rvProofTxt').textContent = '✓ Risiti imewekwa · badilisha'; rvDraftSave(); })
      .catch(function () { RV.proof = ''; $('rvProofTxt').textContent = 'Faili halikufunguka — jaribu lingine'; });
  };
  $('rvGo').onclick = function () {
    var btn = this, i = info() || {}, err = $('rvErr'), v = Math.round(Number(String($('rvTzs').value).replace(/,/g, '')) || 0), r = Number(i.rateRev) || 0; err.textContent = '';
    if (!(v > 0)) return fail(err, 'Weka kiasi cha TZS unacholipa', $('rvTzs'));
    if (r && rvOmr(v, r) < (i.revMin || 5)) return fail(err, 'Kiasi cha chini ni OMR ' + (i.revMin || 5) + ' (TZS ' + tzs((i.revMin || 5) * r + feeFor('rev', i.revMin || 5)) + ')', $('rvTzs'));
    var rn, rp, net, saveNew = false, alts = [], L = (S.me && S.me.payMethods) || [], picked = RV.picks.map(function (id) { return L.filter(function (m) { return m.id === id; })[0]; }).filter(Boolean);
    var typed = $('rvName').value.trim() || $('rvAcc').value.trim();
    if (picked.length && !($('rvNew').style.display !== 'none' && typed)) { rn = picked[0].name; rp = picked[0].acc; net = picked[0].bank || ''; alts = picked.slice(1).map(function (m) { return { name: m.name, acc: m.acc, bank: m.bank }; }); }
    else { rn = $('rvName').value.trim(); alts = picked.slice(0, 2).map(function (m) { return { name: m.name, acc: m.acc, bank: m.bank }; }); rp = $('rvAcc').value.replace(/[\s-]/g, ''); net = RV.kind === 'mobile' ? 'Simu Oman' : $('rvNet').value; saveNew = !!$('rvSave').checked;
      if (rn.length < 3) return fail(err, 'Weka jina kamili la anayepokea OMR', $('rvName'));
      if (RV.kind === 'bank' ? rp.length < 8 : !/^(\+?968)?[79]\d{7}$/.test(rp)) return fail(err, RV.kind === 'bank' ? 'Weka namba ya akaunti ya benki' : 'Weka namba ya simu ya Oman (9… au 7…, tarakimu 8)', $('rvAcc'));
      if (RV.kind === 'bank' && !net) return fail(err, 'Chagua benki', $('rvNet')); }
    if (!RV.proof) return fail(err, 'Pakia risiti ya malipo ya TZS kwanza', $('rvProofLbl'));
    ask({ icon: '🇴🇲', title: 'Tuma oda ya Nunua Rial?', text: 'Unalipa TZS ' + tzs(v) + ' → unapokea OMR ' + (Math.round(v / r * 1000) / 1000).toFixed(3) + '\nkwa ' + rn.toUpperCase() + ' (' + rp + ')' + (alts.length ? ' au ' + alts.map(function (a) { return a.acc; }).join(' / ') : '') + '\n\nUmeshalipa TZS kwa namba za wakala?', ok: 'Ndiyo, nimeshalipa — tuma', no: 'Bado' }).then(function (yes) { if (!yes) return;
    if (!RV.ck) RV.ck = 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    busy(btn, true, 'Inatuma…');
    var body = { tzs: v, rate: r, rn: rn, rp: rp, net: net, alts: alts, img: RV.proof, ck: RV.ck };
    if (saveNew) api('w_paymethod', { kind: RV.kind, name: rn, acc: rp, bank: net }).then(function (j) { if (j.ok) { S.me.payMethods = j.payMethods || []; setMe(S.me); } }).catch(function () {});
    var go = function () { return apiLoad('w_revorder', body, 'Inatuma oda ya Nunua Rial…', '✓ Oda imepokelewa').then(function (j) {
      busy(btn, false);
      if (!j.ok && j.error === 'twin') return ask({ icon: '👯', title: 'Oda inayofanana ipo', text: j.msg, ok: 'Tuma hii pia', no: 'Acha' }).then(function (y2) { if (y2) { body.again = 1; return go(); } });
      if (!j.ok && j.error === 'rate') { setMe(Object.assign({}, S.me, { info: Object.assign({}, info(), { rateRev: j.rate }) })); $('rvRate').textContent = 'rate 1 OMR = ' + tzs(j.rate) + ' TZS'; rvCalc(); err.textContent = j.msg; return; }
      if (!j.ok) { err.textContent = j.msg || 'Imeshindikana'; return; }
      setMe(j); RV.proof = ''; RV.ck = ''; RV.picks = []; $('rvName').value = ''; $('rvAcc').value = ''; $('rvProof').value = ''; $('rvProofImg').style.display = 'none'; $('rvProofTxt').textContent = 'Pakia risiti ya malipo ya TZS'; $('rvTzs').value = ''; rvCalc(); rvDraftClear();
      loadOrders().then(function () { haptic(); toast('✓ Oda imepokelewa — wakala anahakiki TZS'); if (j.order) openTrack(j.order.ref); else show('hist'); });
    }).catch(function (e) { busy(btn, false); err.textContent = e.message; }); };
    go();
    });
  };

  /* ---------- tuma ---------- */
  function fillSelect(sel, list, ph) { sel.innerHTML = '<option value="">' + ph + '</option>' + list.map(function (x) { return '<option>' + esc(x) + '</option>'; }).join(''); }
  function netFor(p) {
    var d = String(p || '').replace(/\D/g, ''); if (d.indexOf('255') === 0) d = d.slice(3); if (d.charAt(0) === '0') d = d.slice(1);
    if (d.length < 2) return ''; var x = d.slice(0, 2);
    var N = { 'Mixx by Yas': ['65', '67', '71', '77', '70'], 'Vodacom M-Pesa': ['74', '75', '76', '79', '72'], 'Airtel Money': ['68', '69', '78', '66'], 'Halopesa': ['62', '61', '63'], 'TTCL T-Pesa': ['73'] };
    for (var k in N) if (N[k].indexOf(x) >= 0) return k; return '';
  }
  /* rasimu ya oda: mteja anatoka kwenda app ya benki kulipa; akirudi (hata Android ikiwa imefunga app) fomu inarudi kama alivyoiacha */
  var DRAFT_K = 'yzw_draft', DRAFT_P = 'yzw_draft_pf', draftT = 0, draftOn = false;
  function draftSave() {
    if (!draftOn) return; clearTimeout(draftT);
    draftT = setTimeout(function () {
      var on = document.querySelector('.scr.on'); if (!on || on.id !== 's-send') return;
      var d = { at: Date.now(), amt: $('sOmr').value, amtT: !!S.amtT, kind: S.kind, rec: S.rec ? { rp: S.rec.rp, rn: S.rec.rn, net: S.rec.net } : null, isNew: $('sNew').style.display !== 'none',
        rName: $('rName').value, rPhone: $('rPhone').value, rNet: $('rNet').value, netManual: !!S.netManual, rAcc: $('rAcc').value, rBank: $('rBank').value, bankManual: !!S.bankManual,
        biller: S.biller || '', rBillAcc: $('rBillAcc').value, rBillRef: $('rBillRef').value, rBillName: $('rBillName').value, useBal: !!S.useBal };
      var has = d.amt || d.rName || d.rPhone || d.rAcc || d.rBillAcc || S.proof;
      if (!has) { LS.del(DRAFT_K); LS.del(DRAFT_P); return; }
      LS.set(DRAFT_K, d); if (S.proof) LS.set(DRAFT_P, S.proof); else LS.del(DRAFT_P);
    }, 350);
  }
  function draftClear() { LS.del(DRAFT_K); LS.del(DRAFT_P); $('sDraft').classList.remove('on'); }
  function draftRestore() {
    var d = LS.get(DRAFT_K, null); if (!d || !d.at || Date.now() - d.at > 6 * 36e5) { if (d) draftClear(); return false; }
    var saved = (S.me && S.me.recipients) || [];
    if (d.rec) { S.rec = saved.filter(function (r) { return r.rp === d.rec.rp; })[0] || null; drawSaved(saved, false); if (S.rec && isBill(S.rec.net)) setAmt(true); }
    if (!S.rec || d.isNew) { S.rec = d.rec ? S.rec : null; drawSaved(saved, true); setKind(d.kind || 'mobile');
      $('rName').value = d.rName || ''; $('rPhone').value = d.rPhone || ''; $('rAcc').value = d.rAcc || '';
      if (d.kind === 'mobile') { netUi(false); if (d.netManual && d.rNet) { netUi(true); $('rNet').value = d.rNet; } else if (d.rNet && $('rNetBox').style.display === 'flex') $('rNet').value = d.rNet; }
      if (d.kind === 'bank') { bankUi(false); if (d.bankManual && d.rBank) { bankUi(true); $('rBank').value = d.rBank; } else if (d.rBank && $('rBankSel').style.display === 'flex') $('rBank').value = d.rBank; bankWarn(); }
      if (d.kind === 'bill') { S.biller = d.biller || ''; drawBillers(); $('rBillAcc').value = d.rBillAcc || ''; $('rBillRef').value = d.rBillRef || ''; $('rBillName').value = d.rBillName || ''; billWarn(); } }
    setAmt(!!d.amtT); $('sOmr').value = d.amt || ''; if (d.amtT) liveTzs($('sOmr'));
    var pf = LS.get(DRAFT_P, ''); if (pf) { S.proof = pf; setProofUi('s', pf); }
    S.useBal = !!d.useBal; drawBalOpt(); sCalc();
    $('sDraft').classList.add('on');
    return true;
  }
  $('sDraftX').onclick = function () {
    draftClear(); S.rec = null; S.proof = ''; S.useBal = false; S.biller = ''; S.netManual = S.bankManual = false;
    ['sOmr', 'rName', 'rPhone', 'rAcc', 'rBillAcc', 'rBillRef', 'rBillName'].forEach(function (id) { $(id).value = ''; }); $('sProof').value = ''; $('sProofImg').style.display = 'none'; $('sProofTxt').textContent = 'Pakia risiti ya malipo';
    $('rNetTag').style.display = 'none'; $('rNetBox').style.display = 'none'; $('rBankTag').style.display = 'none'; $('rBankSel').style.display = 'none';
    var saved = (S.me && S.me.recipients) || []; S.rec = saved[0] || null; drawSaved(saved, !saved.length); setKind('mobile'); setAmt(false); drawBalOpt(); sCalc(); haptic(); toast('Fomu imesafishwa');
  };
  document.getElementById('s-send').addEventListener('input', draftSave);
  document.getElementById('s-send').addEventListener('change', draftSave);
  document.getElementById('s-send').addEventListener('click', draftSave);
  function openSend(rec, amount) {
    S.ck = ''; draftOn = false; $('sDraft').classList.remove('on');
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
    /* fomu ilivyoachwa (mteja alienda kulipa benki) — inarudishwa akifungua "Tuma" bila kuchagua mpokeaji mpya */
    if (!rec && !amount) draftRestore(); else draftClear();
    draftOn = true; draftSave();
    S.stack.push('send'); show('send', false);
    if (rec && typeof rec === 'object' && !$('sOmr').value) setTimeout(function () { try { $('sOmr').focus({ preventScroll: true }); } catch (e) {} }, 420);   // mpokeaji yupo — anaandika kiasi tu
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
    var f = feeFor('sell', t / g), o = Math.ceil((t + f) / g * 1000) / 1000, g2 = rateFor(o), f2 = feeFor('sell', o); if (g2 !== g || f2 !== f) o = Math.ceil((t + f2) / g2 * 1000) / 1000; return o;
  }
  function setAmt(tz) {
    var prev = !!S.amtT; S.amtT = !!tz; $('amtO').classList.toggle('on', !tz); $('amtT').classList.toggle('on', !!tz);
    $('sOmrL').textContent = tz ? 'Wanapokea (TZS)' : 'Unatuma (OMR)'; if ($('sUnit')) $('sUnit').textContent = tz ? 'TZS' : 'OMR'; $('sTzsL').textContent = tz ? 'Utalipa' : 'Mpokeaji atapata';
    $('sChips').style.display = tz ? 'none' : 'flex';
    $('sOmr').setAttribute('inputmode', tz ? 'numeric' : 'decimal');
    if (prev !== S.amtT) { var v = Number(String($('sOmr').value).replace(/,/g, '')) || 0; if (v) $('sOmr').value = tz ? netT(v) : omrFor(v); }
    if (tz) liveTzs($('sOmr'));
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
    try { var vi = $('sOmr'), ln = String(vi.value || '').length; vi.style.width = Math.max(2, ln + 0.6) + 'ch'; } catch (e) {}   // kisanduku kinakua na namba (kitengo kinakaa karibu)
    var A = amtNow(), o = A.o, r = rateFor(o);
    $('sRateTxt').textContent = r ? 'Rate: 1 OMR = ' + tzs(r) + ' TZS' + feeTxt(feeFor('sell', o)) : 'Rate: —';
    var bn = bonusFor(o);
    $('sTzs').textContent = S.amtT ? omr(o) + ' OMR' : tzs(netT(o) + bn) + ' TZS';
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
  $('sOmr').addEventListener('input', function () { if (S.amtT) liveTzs(this); sCalc(); });
  $('rPhone').addEventListener('input', function () { livePhone(this); });
  $('rName').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); (S.kind === 'mobile' ? $('rPhone') : $('rAcc')).focus(); } });
  $('cf').addEventListener('click', function (e) { if (e.target === this) this.classList.remove('on'); });
  /* maelezo ya malipo: kila namba (akaunti, simu) ina kitufe chake cha kunakili */
  function copyText(t) {
    var fb = function () { var ta = document.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select(); var ok = false; try { ok = document.execCommand('copy'); } catch (e) {} ta.remove(); return ok ? Promise.resolve() : Promise.reject(); };
    return navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(t).catch(fb) : fb();
  }
  function drawPayInto(id, txt) { var keep = $('sPay').innerHTML; drawPay(txt); $(id).innerHTML = $('sPay').innerHTML; $('sPay').innerHTML = keep; }
  function drawPay(txt) {
    /* kila mstari wenye namba/code unapata "Nakili": "TIGO 2: 776438 – RASHID", "NMB: 22910097289 – ALI", "CRDB: O152000ASTV00 – ALI", "Bank Muscat 0311…" */
    var lines = String(txt).split(/\n+/).map(function (x) { return x.replace(/\*/g, '').trim(); }).filter(Boolean), rows = [];
    var strip = function (t) { return t.replace(/^[\s\u{1F300}-\u{1FAFF}\u2600-\u27BF\uFE0F📲💳🏦📌•·\-–:]+|[\s:–\-]+$/gu, '').trim(); };
    lines.forEach(function (ln) {
      var code = '', label = '', who = '';
      var m = ln.match(/^(.*?)[:：]\s*([A-Z0-9][A-Z0-9 \-]{3,})\s*(?:[–\-—]\s*(.+))?$/i);   // LABEL: CODE – JINA
      if (m && /\d{4,}|[A-Z]{1,3}\d{4,}/i.test(m[2].replace(/[\s-]/g, ''))) { label = strip(m[1]); code = m[2].replace(/[\s-]/g, '').toUpperCase(); who = (m[3] || '').trim(); }
      else { var n = ln.match(/(\+?\d[\d\s-]{4,}\d)/); if (n) { code = n[1].replace(/[\s-]/g, ''); label = strip(ln.replace(n[1], '')); } }
      if (code) {
        var kind = code.length >= 12 ? 'Namba ya akaunti' : code.length <= 7 ? 'Lipa namba / code' : 'Namba ya simu';
        rows.push('<div class="payrow"><div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px"><span class="mut" style="font-size:12px;font-weight:700">' + esc(label || kind) + (who ? ' – ' + esc(who) : '') + '</span><span class="num" style="font-size:16px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(code) + '</span></div>'
          + '<button class="cpy" type="button" data-cp="' + esc(code) + '" aria-label="Nakili ' + esc(code) + '"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Nakili</button></div>');
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
      S.proof = d; $('sProofImg').src = d; $('sProofImg').style.display = 'block'; $('sProofTxt').textContent = '✓ Risiti imewekwa · badilisha'; draftSave();
    }).catch(function () { S.proof = ''; $('sProofTxt').textContent = 'Picha haikufunguka — jaribu nyingine'; });
  };
  /* ---------- risiti iliyoshirikiwa kutoka kwenye picha/PDF za mteja (Android "Share" / Web Share Target) ---------- */
  function setProofUi(which, d) {
    var m = { s: ['sProofImg', 'sProofTxt'], b: ['bProofImg', 'bProofTxt'], pd: ['pdProofImg', 'pdProofTxt'] }[which];
    $(m[0]).src = d; $(m[0]).style.display = 'block'; $(m[1]).textContent = '✓ Risiti imewekwa · badilisha';
  }
  function sharedIn(file) {
    if (!S.wt) { toast('Ingia kwanza, kisha shiriki risiti tena'); return; }
    toast('Inaandaa risiti…');
    shrink(file, 1600, 0.82).then(function (d) {
      var open = S.orders.filter(function (o) { return o.st === 'new'; }).slice(0, 6), need = open.filter(function (o) { return !o.proof; });
      var attach = function (ref, btn, done) {
        if (btn) busy(btn, true, 'Inapakia…');
        return apiLoad('w_proofadd', { ref: ref, img: d }, 'Inaambatisha risiti kwenye oda ' + ref + '…', '✓ Risiti imeambatishwa').then(function (j) { if (btn) busy(btn, false); if (!j.ok) return toast(j.msg || 'Imeshindikana');
          S.orders = S.orders.map(function (x) { return x.ref === ref ? j.order : x; }); LS.set('yzw_orders', S.orders); if (done) done(); haptic(); toast('✓ Risiti imeambatishwa kwenye oda ' + ref); openTrack(ref); })
          .catch(function (e) { if (btn) busy(btn, false); toast(e.message); });
      };
      if (need.length === 1 && open.length === 1) return attach(need[0].ref);   // oda moja tu inasubiri risiti → moja kwa moja, bila kuuliza
      var h = '<div class="cfs" style="gap:12px"><div style="width:44px;height:5px;border-radius:3px;background:var(--line);margin:0 auto 2px"></div>'
        + '<div class="row" style="justify-content:space-between"><h2 style="margin:0;font-family:Sora,sans-serif;font-size:20px;font-weight:600">🧾 Risiti imepokelewa</h2><button class="iconbtn" id="shClose" aria-label="Funga">✕</button></div>'
        + '<img src="' + d + '" alt="Risiti" style="width:100%;max-height:220px;object-fit:contain;border-radius:14px;background:#f3f5f4">'
        + '<div class="lbl">Risiti hii ni ya nini?</div>'
        + open.map(function (o) { return '<button class="opt" data-sh-ref="' + esc(o.ref) + '" style="justify-content:space-between"><span><b>📎 Ambatisha kwenye oda ' + esc(o.ref) + '</b><br><span class="mut" style="font-size:12px">' + omr(o.omr) + ' OMR → ' + esc(o.rn || o.net || '') + (o.proof ? ' · tayari ina risiti (itabadilishwa)' : ' · inasubiri risiti') + '</span></span><span>›</span></button>'; }).join('')
        + '<button class="opt" data-sh="send" style="justify-content:space-between"><span><b>➕ Tuma pesa Tanzania (OMR → TZS)</b><br><span class="mut" style="font-size:12px">Umelipa OMR hapa Oman — risiti inaambatishwa yenyewe</span></span><span>›</span></button>'
        + (function () { var i = info() || {}; return i.revOn && i.rateRev ? '<button class="opt" data-sh="rev" style="justify-content:space-between"><span><b>🇴🇲 Nunua Rial (TZS → OMR)</b><br><span class="mut" style="font-size:12px">Umelipa TZS Tanzania — unapokea OMR Oman · rate ' + tzs(i.rateRev) + '</span></span><span>›</span></button>' : ''; })()
        + (S.me && S.me.bal < -0.005 ? '<button class="opt" data-sh="pd" style="justify-content:space-between"><span><b>💳 Lipa deni kwa risiti hii</b><br><span class="mut" style="font-size:12px">Deni ' + omr(-S.me.bal) + ' OMR</span></span><span>›</span></button>'
          : '<button class="opt" data-sh="pd" style="justify-content:space-between"><span><b>🏦 Weka kama amana — nitatuma mpokeaji baadaye</b><br><span class="mut" style="font-size:12px">Pesa inakaa kwenye salio lako; ukituma mpokeaji unalipa kwa salio bila risiti</span></span><span>›</span></button>')
        + '</div>';
      var dlg = $('sh'); if (!dlg) { dlg = document.createElement('div'); dlg.id = 'sh'; dlg.setAttribute('role', 'dialog'); dlg.style.cssText = 'position:fixed;inset:0;z-index:54;background:rgba(6,14,10,.55);display:none;align-items:flex-end;justify-content:center'; document.body.appendChild(dlg); watchDlg(dlg); }
      dlg.innerHTML = h; dlg.style.display = 'flex';
      var close = function () { dlg.style.display = 'none'; };
      $('shClose').onclick = close; dlg.onclick = function (e) { if (e.target === dlg) close(); };
      dlg.querySelectorAll('[data-sh-ref]').forEach(function (b) { b.onclick = function () { attach(b.getAttribute('data-sh-ref'), b, close); }; });
      var sb = dlg.querySelector('[data-sh="send"]'); if (sb) sb.onclick = function () { close(); openSend(); S.proof = d; setProofUi('s', d); draftSave(); toast('Risiti imewekwa — jaza mpokeaji na kiasi'); };
      var pb = dlg.querySelector('[data-sh="pd"]'); if (pb) pb.onclick = function () { close(); openPay(true); PD.proof = d; setProofUi('pd', d); };
      var rb = dlg.querySelector('[data-sh="rev"]'); if (rb) rb.onclick = function () { close(); openRev(); RV.proof = d; $('rvProofImg').src = d; $('rvProofImg').style.display = 'block'; $('rvProofTxt').textContent = '✓ Risiti imewekwa · badilisha'; rvDraftSave(); toast('Risiti ya TZS imewekwa — jaza kiasi na unakopokea OMR'); };
    }).catch(function () { toast('Faili halikufunguka — tuma picha au PDF ya risiti'); });
  }
  function b64File(b64, mime, name) { var bin = atob(b64), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new File([u], name || 'risiti', { type: mime || 'image/jpeg' }); }
  function shareCheck() {   // APK: plugin ShareIn (Android ACTION_SEND)
    var P = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.ShareIn; if (!P || !P.check) return;
    P.check().then(function (r) { if (r && r.has && r.data) sharedIn(b64File(r.data, r.mime, r.name)); }).catch(function () {});
  }
  window.addEventListener('yzShareIn', shareCheck);
  if (navigator.serviceWorker) navigator.serviceWorker.addEventListener('message', function (ev) {   // PWA: Web Share Target (sw.js)
    var m = ev.data || {}; if (m.type === 'yzShare' && m.file) sharedIn(m.file);
  });
  setTimeout(shareCheck, 800);
  /* PDF (risiti ya benki) → picha ya ukurasa wa kwanza, ili ipite njia ile ile ya risiti ya picha */
  function pdfLib() {   // lib/pdf.min.js (pdf.js, UMD) inapakiwa ikihitajika tu
    if (window.pdfjsLib && window.pdfjsLib.getDocument) return Promise.resolve(window.pdfjsLib);
    return new Promise(function (ok, no) {
      var sc = document.createElement('script'); sc.src = 'lib/pdf.min.js';
      sc.onload = function () { var m = window.pdfjsLib; if (!m) return no(new Error('pdfjs')); m.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js'; ok(m); };
      sc.onerror = function () { no(new Error('pdfjs')); }; document.head.appendChild(sc); });
  }
  function pdfToImage(file, max, q) {
    return pdfLib().then(function (L) { return new Promise(function (ok, no) {
      var rd = new FileReader();
      rd.onload = function () {
        L.getDocument({ data: new Uint8Array(rd.result) }).promise.then(function (pdf) { return pdf.getPage(1); }).then(function (pg) {
          var v0 = pg.getViewport({ scale: 1 }), sc = Math.min(3, max / Math.max(v0.width, v0.height)), vp = pg.getViewport({ scale: sc });
          var c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
          var cx = c.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, c.width, c.height);
          return pg.render({ canvasContext: cx, viewport: vp }).promise.then(function () { ok(c.toDataURL('image/jpeg', q)); });
        }).catch(no);
      };
      rd.onerror = no; rd.readAsArrayBuffer(file);
    }); });
  }
  function isPdf(file) { return /pdf/i.test(file.type || '') || /\.pdf$/i.test(file.name || ''); }
  function shrink(file, max, q) {
    if (isPdf(file)) return pdfToImage(file, max, q);
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
    if (!(o >= (i.min || 1))) return fail(err, S.amtT ? 'Kiasi cha chini ni ' + omr(i.min || 1) + ' OMR (≈ TZS ' + tzs((i.min || 1) * rateFor(i.min || 1)) + ')' : 'Weka kiasi cha OMR unachotuma', $('sOmr'));
    var le = limErr(o, rateFor(o)); if (le) return fail(err, le, $('sOmr'));
    var body = { omr: o, rate: rateFor(o) }; if (S.amtT) body.tzs = A.t;
    if (S.rec) { body.rn = S.rec.rn; body.rp = S.rec.rp; body.net = S.rec.net; body.kind = isBill(S.rec.net) ? 'bill' : /^0[67]\d{8}$/.test(String(S.rec.rp).replace(/\D/g, '')) || /M-Pesa|Mixx|Airtel|Halo|T-Pesa|TTCL/i.test(S.rec.net) ? 'mobile' : 'bank'; }
    else if (S.kind === 'bill') {
      var B0 = BL[S.biller]; if (!B0) return fail(err, 'Chagua unacholipa (LUKU, maji, TV…)', $('rBillers'));
      body.kind = 'bill'; body.net = S.biller; body.rp = $('rBillAcc').value.replace(/\s+/g, '').toUpperCase(); body.rn = $('rBillName').value.trim(); body.bref = $('rBillRef').value.trim();
      if (body.rp.length < 3) return fail(err, 'Weka ' + B0.f.toLowerCase(), $('rBillAcc'));
      if (B0.chk && !B0.chk.re.test(body.rp)) body.warn = B0.chk.msg;   // haizuii — inaonyeshwa kwenye muhtasari wa kuhakiki
      if (B0.r && body.bref.length < 2) return fail(err, 'Weka ' + B0.r.toLowerCase(), $('rBillRef'));
    }
    else {
      body.rn = $('rName').value; body.kind = S.kind;
      if (S.kind === 'mobile') { body.rp = $('rPhone').value.replace(/[\s-]/g, ''); body.net = $('rNet').value; } else { body.rp = $('rAcc').value.replace(/[\s-]/g, ''); body.net = $('rBank').value; }
      if (String(body.rn).trim().length < 3) return fail(err, 'Weka jina kamili la mpokeaji', $('rName'));
      if (!body.rp) return fail(err, S.kind === 'mobile' ? 'Weka namba ya simu ya mpokeaji' : 'Weka namba ya akaunti', S.kind === 'mobile' ? $('rPhone') : $('rAcc'));
      if (S.kind === 'mobile' && !/^0[67]\d{8}$/.test(body.rp.replace(/^\+?255/, '0'))) return fail(err, 'Namba ya simu ya Tanzania ina tarakimu 10 na inaanza na 06 au 07 (mf. 0754 123 456)', $('rPhone'));
      if (!body.net) { if (S.kind === 'mobile') { netUi(true); return fail(err, 'Chagua mtandao wa mpokeaji', $('rNet')); } bankUi(true); return fail(err, 'Chagua benki ya mpokeaji', $('rBank')); }
      if (S.kind === 'bank') { var BF = BANK_FMT[body.net], ba = String(body.rp).toUpperCase().replace(/[\s-]/g, ''); if (BF && !BF.re.test(ba)) body.warn = 'Akaunti za ' + body.net + ' kwa kawaida: ' + BF.h + '.'; }
    }
    if (S.useBal) {
      if (balAvail() + 0.0005 < o) return fail(err, 'Salio lako ni ' + omr(balAvail()) + ' OMR tu — halitoshi kwa oda hii. Ondoa alama ya "Lipa kwa salio" ulipe kawaida.', $('sBalOpt'));
      body.useBal = 1;
    } else {
      if (!S.proof) return fail(err, 'Pakia risiti ya malipo yako ya OMR kwanza', $('sProofLbl'));
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
    $('cfTzs').textContent = tzs(netT(body.omr) + bn) + ' TZS';
    var fe = feeFor('sell', body.omr);
    if (body.tzs) $('cfTzs').textContent = tzs(body.tzs + bn) + ' TZS';
    var bb = body.kind === 'bill' ? (BL[net] || {}) : null;
    $('cfRows').innerHTML = (bb ? [['Malipo', (bb.ic || '') + ' ' + (bb.t || net)], [bb.f || 'Namba', body.rp]].concat(body.bref ? [[bb.r || 'Kumbukumbu', body.bref]] : []).concat(body.rn ? [['Jina', body.rn]] : []).concat([['Rate', '1 OMR = ' + tzs(r) + ' TZS']]).concat(fe ? [['💸 Ada ya kutuma', tzs(fe) + ' TZS']] : [])
      : [['Mpokeaji', String(body.rn || '').toUpperCase()], [body.kind === 'bank' ? 'Benki' : 'Mtandao', net], [body.kind === 'bank' ? 'Akaunti' : 'Namba', body.rp], ['Rate', '1 OMR = ' + tzs(r) + ' TZS']]).concat(fe ? [['💸 Ada ya kutuma', '− ' + tzs(fe) + ' TZS']] : []).concat(bn ? [['🎁 Zawadi ya rafiki', '+ ' + tzs(bn) + ' TZS']] : [])
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
    apiLoad('w_order', send, 'Inatuma oda…', '✓ Oda imepokelewa').then(function (j) {
      busy(btn, false);
      if (!j.ok && j.error === 'twin') return ask({ icon: '👯', title: 'Oda inayofanana ipo', text: j.msg, ok: 'Tuma hii pia', no: 'Nione ile ya awali' }).then(function (yes) {
        if (yes) { body.again = 1; return submit(body, btn); }
        $('cf').classList.remove('on'); loadOrders().then(function () { S.stack = ['home']; openTrack(j.ref); });
      });
      if (!j.ok) { err.textContent = j.msg || 'Imeshindikana'; if (j.error === 'bal') loadMe().then(drawBalOpt); if (j.error === 'rate') Promise.all([loadInfo(), loadMe()]).then(function () { sCalc(); $('cf').classList.remove('on'); $('sErr').textContent = j.msg; }); return; }
      $('cf').classList.remove('on'); S.ck = ''; S.useBal = false; draftClear();
      S.proof = ''; $('sProof').value = ''; $('sProofImg').style.display = 'none'; $('sProofTxt').textContent = 'Pakia risiti ya malipo'; $('sOmr').value = '';
      ['rName', 'rPhone', 'rAcc', 'rBillAcc', 'rBillRef', 'rBillName'].forEach(function (id) { $(id).value = ''; });
      if (!j.dup) { S.orders.unshift(j.order); LS.set('yzw_orders', S.orders); }
      S.stack = ['home']; showOk(j.order);
      loadMe(); loadOrders();
    }).catch(function (e) { busy(btn, false); err.textContent = e.message + ' — oda haijatumwa, jaribu tena.'; });
  }

  /* ---------- risiti imesomwa (kisomaji cha seva): muhtasari kwa mteja ---------- */
  function rcCard(rc) {
    if (!rc || !rc.amt) return '';
    var amt = rc.cur === 'OMR' ? omr(rc.amt) + ' OMR' : tzs(rc.amt) + ' TZS', head = '🧾 Risiti yako: <b>' + amt + '</b>' + (rc.bank ? ' · ' + esc(rc.bank) : '') + (rc.date ? ' · ' + esc(rc.date.slice(8, 10) + '/' + rc.date.slice(5, 7)) : '');
    if (rc.dup) return '<div class="card" style="border-color:#F3C4BE;background:var(--bad-soft);font-size:14px;line-height:1.55">' + head + '<div style="margin-top:6px"><b style="color:var(--bad)">⚠️ Risiti hii ishatumika</b> — ' + esc(rc.dup.replace(/^Rejea\s+\S+\s+ILISHATUMIKA kwenye\s+/i, '')) + '. Tuma risiti ya malipo mapya.</div></div>';
    if (rc.old || rc.amtNote) return '<div class="card" style="border-color:#F2D49B;background:var(--warn-soft);font-size:14px;line-height:1.55">' + head + '<div style="margin-top:6px">⚠️ ' + esc(rc.old || rc.amtNote) + ' — wakala ataihakiki.</div></div>';
    return '<div class="card" style="background:var(--ok-soft);font-size:14px;line-height:1.55">' + head + ' ✅</div>';
  }
  function rcCheck(ref, box) {   // baada ya kupakia risiti: seva inaisoma (sekunde chache) → onyo papo hapo ikiwa ishatumika
    if (!box) return; box.innerHTML = '<div class="mut" style="font-size:13px">🔍 Tunasoma risiti yako…</div>';
    api('w_rcread', { ref: ref }).then(function (j) {
      if (!j.ok) { box.innerHTML = ''; return; }
      box.innerHTML = rcCard(j.rc) || '';
      if (j.rejected) { var o = S.orders.filter(function (x) { return x.ref === ref; })[0]; if (o) { o.st = 'no'; o.label = 'Risiti ishatumika — oda imesitishwa'; o.rc = j.rc; LS.set('yzw_orders', S.orders); } }
      else { var o2 = S.orders.filter(function (x) { return x.ref === ref; })[0]; if (o2) { o2.rc = j.rc; LS.set('yzw_orders', S.orders); } }
      loadOrders();
    }).catch(function () { box.innerHTML = ''; });
  }
  /* ---------- imefanikiwa ---------- */
  function showOk(o) {
    $('okT').textContent = 'Oda imepokelewa!'; $('okTrack').textContent = 'Fuatilia oda';
    $('okAmt').textContent = tzs(o.tzs) + ' TZS';
    $('okTxt').textContent = o.kind === 'bill' ? (o.net || 'Bili') + ' · ' + o.rp + '. Tunathibitisha malipo yako sasa — utapata taarifa ikilipwa' + (/LUKU|ZECO|TUKUZA/.test(o.net) ? ', na TOKEN itaonekana kwenye app.' : '.') : 'Kwa ' + (o.rn || 'mpokeaji') + (o.net ? ' · ' + o.net : '') + '. Tunathibitisha malipo yako sasa — utapata taarifa pesa ikifika.';
    $('okRef').textContent = o.ref; $('ok').classList.add('on'); haptic();
    var rb = $('okRc'); if (!rb) { rb = document.createElement('div'); rb.id = 'okRc'; rb.style.cssText = 'width:100%;max-width:360px;margin-top:6px'; $('okTxt').parentNode.insertBefore(rb, $('okTxt').nextSibling); }
    rb.innerHTML = ''; if (o.proof || o.pf) rcCheck(o.ref, rb);
    $('okTrack').onclick = function () { $('ok').classList.remove('on'); openTrack(o.ref); };
    $('okHome').onclick = function () { $('ok').classList.remove('on'); S.stack = ['home']; show('home', false); };
  }

  /* ---------- fuatilia ---------- */
  /* oda iliyosimama (imeghairiwa/imekataliwa/imesitishwa/pesa imerudi): ratiba inaishia na hatua nyekundu ✕ badala ya "Bado" */
  var END_ST = { no: 1, cancel: 1, rstop: 1, stop: 1, returned: 1, refunded: 1, used: 1, lost: 1 };
  function endSteps(o, steps) {
    if (!END_ST[o.st]) return steps;
    var stp = Math.max(1, Number(o.step) || 1), done = steps.filter(function (s2) { return stp >= s2[2]; });
    var txt = o.st === 'cancel' ? 'Umeghairi oda hii' : o.st === 'no' ? (o.label || 'Oda imesitishwa — malipo hayajaonekana') : o.st === 'rstop' ? (o.label || 'Oda imesitishwa') : o.st === 'returned' ? 'Imesitishwa — pesa imerudi kwenye salio lako' : o.st === 'refunded' ? 'Imesitishwa — umerudishiwa pesa' : o.st === 'used' ? 'Imesitishwa — pesa imetumika kwenye oda nyingine' : o.st === 'lost' ? 'Imesitishwa — pesa haikurudi' : 'Imesitishwa — pesa haijatumwa';
    var at = o.endAt || o.stAt || o.rfAt || 0;
    return done.concat([[txt, at ? when(at) : 'Haitaendelea', 99, 'end']]);
  }
  function stepsHtml(o, steps) {
    steps = endSteps(o, steps);
    return '<div class="card steps" style="padding:16px 16px 6px">' + steps.map(function (s2, k) {
      var end = s2[3] === 'end', done = !end && o.step >= s2[2], now = !end && !done && o.step === s2[2] - 1, last = k === steps.length - 1;
      return '<div class="st' + (done ? ' done' : '') + (now ? ' now' : '') + (end ? ' end' : '') + '"><div style="display:flex;flex-direction:column;align-items:center"><span class="dot">' + (done ? svg('check', 14, '#fff', 3) : end ? '<span style="color:#fff;font-weight:800;font-size:14px;line-height:1">✕</span>' : '') + '</span>' + (!last ? '<span class="bar"></span>' : '') + '</div>'
        + '<div style="display:flex;flex-direction:column;gap:2px;padding:2px 0 ' + (!last ? '8' : '10') + 'px"><span style="font-weight:800;font-size:15px;' + (done ? '' : end ? 'color:var(--bad)' : 'color:var(--mut)') + '">' + esc(s2[0]) + '</span><span class="mut" style="font-size:13px">' + esc(s2[1]) + '</span></div></div>';
    }).join('') + '</div>';
  }
  function openTrack(ref) { S.cur = ref; S.stack.push('track'); show('track', false); }
  function drawRevTrack(o) {
    var rchk = o.st === 'rchk', rno = o.st === 'rno', rpay = o.st === 'rpay', rdone = o.st === 'rdone';
    var steps = [['Oda imepokelewa · risiti ya TZS imepakiwa', when(o.at), 1], ['Wakala amethibitisha TZS zimeingia', rpay || rdone ? 'Imethibitishwa' : rno ? 'Hazijaonekana' : 'Wakala anaangalia akaunti zake', 2], ['OMR zimelipwa Oman', rdone ? when(o.paidAt) : 'Bado', 3]];
    var h = '<div class="rev-card" style="border-radius:20px;padding:18px;display:flex;flex-direction:column;gap:8px">'
      + '<div class="row" style="justify-content:space-between"><span style="font-size:13px;opacity:.85">🇴🇲 Nunua Rial · kwa ' + esc(o.rn || '') + (o.net ? ' · ' + esc(o.net) : '') + '</span>' + pill(o) + '</div>'
      + '<div class="num" style="font-size:28px;font-weight:700;color:#FFD166">' + omr(o.omr) + ' OMR</div>'
      + '<div style="font-size:13px;opacity:.85">Umelipa TZS ' + tzs(o.tzs) + ' · Rate ' + tzs(o.rate) + '</div>'
      + '<div style="font-size:12.5px;opacity:.9;display:flex;flex-direction:column;gap:2px">' + [{ name: o.rn, acc: o.rp, bank: o.net }].concat(o.alts || []).filter(function (x) { return x && x.acc; }).map(function (x) { var hit = o.paidTo && o.paidTo.acc === x.acc; return '<span>' + (hit ? '✅ ' : (o.alts && o.alts.length ? '• ' : '')) + esc(x.bank || '') + ' · ' + esc(x.acc) + (hit ? ' <b>(imelipwa hapa)</b>' : '') + '</span>'; }).join('') + '</div></div>';
    if (o.rc && (o.rc.dup || o.rc.old)) h += rcCard(o.rc);
    if (o.st === 'cancel') h += '<div class="card" style="font-size:14px;line-height:1.55"><b>Umeghairi oda hii.</b></div>';
    else if (o.st === 'rstop') h += '<div class="card" style="border-color:#F3C4BE;background:var(--bad-soft)"><b style="color:var(--bad)">⛔ ' + esc(o.label || 'Oda imesitishwa na WakalaOnline') + '</b>' + (o.note ? '<div style="margin-top:6px;font-size:14px">Sababu: ' + esc(o.note) + '</div>' : '') + '<div style="margin-top:8px;font-size:14px">Kama ulishalipa TZS kwa namba za wakala, wasiliana nasi WhatsApp ukiwa na Ref <b>' + esc(o.ref) + '</b> — tutakurudishia au tutaikamilisha.</div></div>'
      + '<a class="btn dark" target="_blank" rel="noopener" href="https://wa.me/' + HELP_WA + '?text=' + encodeURIComponent('Habari, naomba msaada kuhusu oda ' + o.ref + ' (Nunua Rial) iliyositishwa') + '">Wasiliana nasi WhatsApp</a>';
    else if (rno) h += '<div class="card" style="border-color:#F3C4BE;background:var(--bad-soft)"><b style="color:var(--bad)">TZS hazijaonekana kwa wakala</b>' + (o.note ? '<div style="margin-top:6px;font-size:14px">Wakala: ' + esc(o.note) + '</div>' : '') + '<div style="margin-top:8px;font-size:14px">Hakikisha ulilipa kwa namba sahihi, kisha pakia risiti sahihi — wakala atahakiki tena.</div></div>'
      + '<label class="btn" style="position:relative;cursor:pointer">📎 Pakia risiti sahihi ya TZS<input type="file" accept="image/*,application/pdf" id="tProof" style="position:absolute;opacity:0;width:1px;height:1px"></label>';
    else if (rdone) h += '<div class="card" style="background:var(--ok-soft);font-size:14px;line-height:1.55"><b>🎉 OMR ' + omr(o.omr) + ' zimelipwa</b> kwa ' + esc(o.rn || '') + (o.paidAt ? ' · ' + when(o.paidAt) : '') + '.</div>' + (o.receipt ? '<div id="tRc" class="card" style="padding:8px;cursor:pointer"><div class="mut" style="font-size:12px;font-weight:700;padding:4px 6px">Risiti ya malipo ya OMR</div></div>' : '');
    else if (rpay) h += '<div class="card" style="background:var(--ok-soft);font-size:14px;line-height:1.55"><b>✅ TZS zimeingia.</b> Tunakulipa OMR ' + omr(o.omr) + ' sasa — utapata risiti hapa na kwenye WhatsApp.</div>';
    else h += '<div class="card mut" style="font-size:14px;line-height:1.55">⏳ Wakala wetu Tanzania anaangalia kama TZS ' + tzs(o.tzs) + ' zimeingia. Ikithibitishwa, tunakulipa OMR Oman.</div>'
      + '<label class="btn ghost" style="position:relative;cursor:pointer">📎 Badilisha risiti ya TZS<input type="file" accept="image/*,application/pdf" id="tProof" style="position:absolute;opacity:0;width:1px;height:1px"></label>';
    h += stepsHtml(o, steps);
    $('tBody').innerHTML = h;
    var tp = $('tProof'); if (tp) tp.onchange = function () {
      var f = this.files && this.files[0]; if (!f) return; toast('Inaandaa risiti…');
      shrink(f, 1600, 0.82).then(function (d) { return apiLoad('w_proofadd', { ref: o.ref, img: d }, 'Inaambatisha risiti…', '✓ Risiti imeambatishwa'); }).then(function (j) { if (!j.ok) return toast(j.msg || 'Imeshindikana');
        S.orders = S.orders.map(function (x) { return x.ref === o.ref ? j.order : x; }); LS.set('yzw_orders', S.orders); haptic(); drawTrack(); })
        .catch(function () { toast('Faili halikufunguka — tuma picha au PDF ya risiti'); });
    };
    if (o.receipt) receiptImg(o).then(function (url) { var b = $('tRc'); if (!b || S.cur !== o.ref) return; b.innerHTML += '<img src="' + url + '" alt="Risiti" style="width:100%;border-radius:14px;display:block">'; b.onclick = function () { viewReceipt(o, url); }; }).catch(function () {});
  }
  function drawTrack() {
    var o = S.orders.filter(function (x) { return x.ref === S.cur; })[0];
    $('tTitle').textContent = 'Oda ' + (S.cur || '');
    if (!o) { $('tBody').innerHTML = '<div class="empty">Oda haipatikani</div>'; return; }
    if (o.dir === 'to') return drawRevTrack(o);
    var steps = [
      ['Oda imepokelewa', when(o.at), 1],
      ['Malipo yako yamethibitishwa', o.okAt ? when(o.okAt) : (o.step >= 2 ? 'Imethibitishwa' : 'Tunaangalia risiti yako'), 2],
      [o.kind === 'bill' ? 'Bili imelipwa' : 'Pesa imefika kwa mpokeaji', o.paidAt ? when(o.paidAt) + (o.okAt ? ' · ndani ya dakika ' + Math.max(1, Math.round((o.paidAt - o.at) / 60000)) : '') : 'Bado', 3]
    ];
    var bad = o.st === 'no' || o.st === 'stop' || o.st === 'lost' || o.st === 'rstop';
    var h = '<div style="background:var(--brand);color:#fff;border-radius:20px;padding:18px;display:flex;flex-direction:column;gap:8px">'
      + '<div class="row" style="justify-content:space-between"><span style="font-size:13px;color:var(--on-brand-mut)">' + (o.kind === 'bill' ? ((BL[o.net] || {}).ic || '🧾') + ' ' + esc(o.net) + ' · ' + esc(o.rp) : 'Kwa ' + esc(o.rn || 'mpokeaji') + (o.net ? ' · ' + esc(o.net) : '')) + '</span>' + pill(o) + '</div>'
      + '<div class="num" style="font-size:28px;font-weight:700;color:var(--lime)">' + tzs(o.tzs) + ' TZS</div>'
      + '<div style="font-size:13px;color:var(--on-brand-mut)">Umetuma ' + omr(o.omr) + ' OMR · Rate ' + tzs(o.rate) + (o.rp ? ' · ' + esc(o.rp) : '') + (o.bonus ? ' · 🎁 zawadi TZS ' + tzs(o.bonus) : '') + '</div>' + (o.bt ? '<div style="font-size:12px;color:var(--on-brand-mut);font-weight:700">📦 Kundi ' + esc(o.bt) + ' · mpokeaji ' + o.bn + ' kati ya ' + o.bc + '</div>' : '') + '</div>';
    var TL_DONE = false;
    if (o.st === 'refunded') {
      h += '<div class="card" style="background:var(--ok-soft);font-size:14px;line-height:1.55"><b>↩️ Umerudishiwa pesa.</b> Muamala huu ulisitishwa, pesa ikarudi, na OMR <b>' + omr(o.rfOmr || o.back || o.omr) + '</b> zimerudishwa kwako' + (o.rfAt ? ' (' + when(o.rfAt) + ')' : '') + '.' + (o.note ? '<div style="margin-top:6px">Sababu ya kusitisha: ' + esc(o.note) + '</div>' : '') + '</div>';
    } else if (o.st === 'used') {
      h += '<div class="card" style="background:var(--ok-soft);font-size:14px;line-height:1.55"><b>↪️ Imetumika kwenye muamala mwingine.</b> Muamala huu ulisitishwa, pesa ikarudi kwenye salio lako, na umeitumia kwenye oda ' + (o.rfRef ? '<b>' + esc(o.rfRef) + '</b>' : 'nyingine') + '.' + (o.note ? '<div style="margin-top:6px">Sababu ya kusitisha: ' + esc(o.note) + '</div>' : '') + '</div>'
        + (o.rfRef ? '<button class="btn ghost" id="tGoRef" data-ref="' + esc(o.rfRef) + '">Fungua oda ' + esc(o.rfRef) + '</button>' : '');
    } else if (o.st === 'returned') {
      var amt = omr(o.back || o.omr);
      h += '<div class="card" style="border-color:#F2D49B;background:var(--warn-soft);font-size:14px;line-height:1.55"><b>↩️ Pesa imerudi.</b> Muamala huu ulisitishwa na OMR <b>' + amt + '</b> zimerudi kwenye salio lako' + (o.stAt ? ' (' + when(o.stAt) + ')' : '') + '.' + (o.note ? '<div style="margin-top:6px">Sababu: ' + esc(o.note) + '</div>' : '') + '</div>';
      if (o.req === 'refund') h += '<div class="card" style="background:var(--ok-soft);font-size:14px;line-height:1.55"><b>🙋 Umeomba refund.</b> Tunakurudishia OMR ' + amt + ' — utapata taarifa ikikamilika.</div>';
      else if (o.req === 'bal') h += '<div class="card" style="background:var(--ok-soft);font-size:14px;line-height:1.55"><b>💰 Zimebaki kwenye salio lako.</b> Ukituma mpokeaji ujao, chagua "Lipa kwa salio langu" — bila risiti.</div><button class="btn ghost" id="tRetRefund">Nimebadili — naomba refund</button>';
      else h += '<div class="lbl">Unataka tufanye nini na OMR ' + amt + '?</div>'
        + '<button class="btn" id="tRetBal">💰 Zibaki kwenye salio langu</button>'
        + '<button class="btn ghost" id="tRetRefund">↩ Naomba mnirudishie (refund)</button>';
    } else if (o.st === 'cancel') {
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
      h += (o.rc && o.rc.dup ? rcCard(o.rc) : '') + '<div class="card" style="border-color:#F3C4BE;background:var(--bad-soft)"><b style="color:var(--bad)">' + esc(o.label) + '</b>' + (o.note ? '<div style="margin-top:6px;font-size:14px">Sababu: ' + esc(o.note) + '</div>' : '') + (o.st === 'stop' ? '<div style="margin-top:6px;font-size:14px">Pesa haijatumwa kwa mpokeaji. Ikirudi, itaingia kwenye salio lako na tutakujulisha.</div>' : '')
        + '<div style="margin-top:8px;font-size:14px">Tafadhali wasiliana nasi kwenye WhatsApp ukiwa na Ref <b>' + esc(o.ref) + '</b>.</div></div>'
        + '<a class="btn dark" target="_blank" rel="noopener" href="https://wa.me/' + HELP_WA + '?text=' + encodeURIComponent('Habari, naomba msaada kuhusu oda ' + o.ref) + '">Wasiliana nasi WhatsApp</a>';
    } else {
      if (o.rc && (o.rc.old || o.rc.amtNote)) h += rcCard(o.rc);
      if (o.kind === 'bill' && /LUKU|ZECO|TUKUZA/.test(o.net || '')) h += o.token
        ? '<div class="tokbox"><span class="lbl">🔑 TOKEN YA UMEME</span><span class="num" style="font-size:24px;font-weight:700;letter-spacing:.06em;line-height:1.3">' + esc(o.token) + '</span><button class="btn dark" type="button" data-tok="' + esc(o.token) + '">Nakili token</button><span class="mut" style="font-size:12px">Ingiza token hii kwenye mita ' + esc(o.rp) + '</span></div>'
        : '<div class="tokbox" style="border-style:dotted"><span class="lbl">🔑 TOKEN YA UMEME</span><span class="mut" style="font-size:14px">Token itaonekana hapa wakala akishalipa — utapata pia taarifa juu ya simu.</span></div>';
      if (o.st === 'part') h += '<div class="card" style="border-color:#BFE3C9;background:var(--ok-soft,#EAF6EE);display:flex;flex-direction:column;gap:4px"><b style="color:var(--ok-ink,#1F7A32)">⏳ Imetumwa sehemu</b><div style="font-size:14px">TZS <b class="num">' + tzs(o.paidTzs || 0) + '</b> kati ya ' + tzs(o.tzs) + ' zimeshafika kwa ' + esc(o.rn || 'mpokeaji') + '. Zilizobaki <b class="num">' + tzs(Math.max(0, o.tzs - (o.paidTzs || 0))) + '</b> zinatumwa hivi punde.</div></div>';
      h += stepsHtml(o, steps);
      TL_DONE = true;
      if (o.receipt) {
        h += '<div style="display:flex;flex-direction:column;gap:10px"><span class="lbl">Risiti ya malipo Tanzania</span>'
          + '<button id="tRc" class="card" style="padding:8px;cursor:zoom-in;min-height:120px;display:flex;align-items:center;justify-content:center" aria-label="Ona risiti kubwa"><span class="spin" aria-hidden="true" style="color:var(--brand)"></span></button>'
          + '<button class="btn dark" id="tShare"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4"/><path d="m15.4 6.5-6.8 4"/></svg>Shiriki risiti (picha)</button>'
          + '<button class="btn ghost" id="tPdf">Pakua risiti (PDF)</button></div>';
      } else if (o.st === 'paid') {
        h += '<div class="card mut" style="font-size:14px">Pesa imetumwa. Risiti itaonekana hapa wakala akiipakia.</div>';
      } else {
        if (o.st === 'new') h += '<label class="btn' + (o.proof ? ' ghost' : '') + '" style="position:relative;cursor:pointer">' + (o.proof ? '📎 Badilisha risiti' : '📎 Pakia risiti ya malipo (picha / PDF)') + '<input type="file" accept="image/*,application/pdf" id="tProof" style="position:absolute;opacity:0;width:1px;height:1px"></label>'
          + '<button class="btn ghost" id="tCancel" style="color:var(--bad)">Ghairi oda hii</button>';
        h += '<div class="card mut" style="font-size:14px">Ukurasa huu unajisasisha wenyewe. Pesa ikifika, risiti itaonekana hapa na pia utatumiwa kwenye WhatsApp.</div>';
      }
    }
    if (!TL_DONE && o.st !== 'hold') h += stepsHtml(o, steps);   // oda iliyosimama: ratiba inaonyesha ilipoishia (✕), si "Bado"
    /* tuma tena kwa mpokeaji huyu huyu (jina, namba, mtandao vinajaa; kiasi kile kile kinapendekezwa) */
    if (o.rn && o.st !== 'cancel') h += '<button class="btn dark" id="tAgain" style="margin-top:4px">↻ Mtumie tena ' + esc(firstName(o.rn)) + (o.kind === 'bill' ? ' · ' + esc(o.net || 'bili') : '') + '</button>';
    $('tBody').innerHTML = h;
    var tp = $('tProof'); if (tp) tp.onchange = function () {
      var f = this.files && this.files[0]; if (!f) return; toast('Inaandaa risiti…');
      shrink(f, 1600, 0.82).then(function (d) { return apiLoad('w_proofadd', { ref: o.ref, img: d }, 'Inaambatisha risiti…', '✓ Risiti imeambatishwa'); }).then(function (j) { if (!j.ok) return toast(j.msg || 'Imeshindikana');
        S.orders = S.orders.map(function (x) { return x.ref === o.ref ? j.order : x; }); LS.set('yzw_orders', S.orders); haptic(); toast('✓ Risiti imeambatishwa kwenye oda ' + o.ref); drawTrack(); })
        .catch(function () { toast('Faili halikufunguka — tuma picha au PDF ya risiti'); });
    };
    var ag = $('tAgain'); if (ag) ag.onclick = function () {
      var recs = (S.me && S.me.recipients) || [], m = String(o.rp || '').replace(/\s/g, ''), a = m.indexOf('•') >= 0 ? m.split('•')[0] : m, z = m.slice(-3);
      var r = recs.filter(function (x) { var p = String(x.rp || '').replace(/\s/g, ''); return (m.indexOf('•') < 0 ? p === m : (p.indexOf(a) === 0 && p.slice(-3) === z)) && (!o.rn || String(x.rn).toLowerCase() === String(o.rn).toLowerCase() || true); })[0]
        || recs.filter(function (x) { return String(x.rn || '').toLowerCase() === String(o.rn || '').toLowerCase(); })[0];
      if (!r) { if (o.kind === 'bill') r = { rn: o.rn, rp: o.rp, net: o.net }; else return toast('Mpokeaji huyu hayupo kwenye kitabu chako — mtafute kwenye Tuma'); }
      openSend(r); $('sOmr').value = ''; sCalc(); setTimeout(function () { $('sOmr').focus(); }, 300);   // kiasi anaandika upya
    };
    var tk = $('tBody').querySelector('[data-tok]'); if (tk) tk.onclick = function () { var b = this; copyText(b.getAttribute('data-tok')).then(function () { haptic(); b.textContent = '✓ Imenakiliwa'; toast('✓ Token imenakiliwa'); setTimeout(function () { b.textContent = 'Nakili token'; }, 2000); }); };
    var gr = $('tGoRef'); if (gr) gr.onclick = function () { openTrack(gr.getAttribute('data-ref')); };
    var retPick = function (btn, choice) {
      (choice === 'refund' ? ask({ icon: '↩️', title: 'Naomba refund', text: 'Tukurudishie OMR ' + omr(o.back || o.omr) + ' badala ya kuzitumia kwenye oda ijayo?', ok: 'Ndiyo, nirudishieni', no: 'Acha' }) : Promise.resolve(true)).then(function (yes) { if (!yes) return;
      busy(btn, true, 'Inatuma…');
      apiLoad('w_retchoice', { ref: o.ref, choice: choice }, 'Inatuma chaguo lako…', '✓ Imepokelewa').then(function (j) { busy(btn, false); if (!j.ok) return toast(j.msg || 'Imeshindikana');
        S.orders = S.orders.map(function (x) { return x.ref === o.ref ? j.order : x; }); LS.set('yzw_orders', S.orders); drawTrack(); haptic(); toast(choice === 'refund' ? '✓ Ombi la refund limetumwa' : '✓ Zimebaki kwenye salio lako'); })
        .catch(function (e) { busy(btn, false); toast(e.message); });
      });
    };
    var rb = $('tRetBal'), rr = $('tRetRefund'); if (rb) rb.onclick = function () { retPick(this, 'bal'); }; if (rr) rr.onclick = function () { retPick(this, 'refund'); };
    var hy = $('tHoldYes'), hn = $('tHoldNo'), hs = $('tHoldSend');
    var holdReply = function (btn, body, okMsg) {
      busy(btn, true, 'Inatuma…');
      apiLoad('w_holdreply', body, 'Inathibitisha mpokeaji…', '✓ Imepokelewa').then(function (j) { busy(btn, false); if (!j.ok) return toast(j.msg || 'Imeshindikana');
        haptic(); S.orders = S.orders.map(function (x) { return x.ref === o.ref ? j.order : x; }); LS.set('yzw_orders', S.orders); drawTrack(); toast(okMsg); })
        .catch(function (e) { busy(btn, false); toast(e.message); });
    };
    if (hy) hy.onclick = function () { var b = this; ask({ icon: '✅', title: 'Ni mtu sahihi?', text: (o.note || '') + ' ndiye mpokeaji sahihi? Pesa itatumwa kwake sasa.', ok: 'Ndiyo, tumeni', no: 'Hapana' }).then(function (yes) { if (yes) holdReply(b, { ref: o.ref, ok: true }, '✅ Asante — wakala anatuma sasa'); }); };
    if (hn) hn.onclick = function () { var f = $('tHoldForm'); f.style.display = f.style.display === 'none' ? 'flex' : 'none'; if (f.style.display === 'flex') $('tHrn').focus(); };
    if (hs) hs.onclick = function () { var rn = $('tHrn').value.trim(), rp = $('tHrp').value.replace(/[\s-]/g, '');
      if (rn.length < 2) return toast('Andika jina kamili la mpokeaji'); if (rp.length < 9) return toast('Namba/akaunti si sahihi');
      var b = this; ask({ icon: '✏️', title: 'Tuma kwa mpokeaji huyu?', text: 'TZS ' + tzs(o.tzs) + ' kwa ' + rn.toUpperCase() + ' · ' + rp, ok: 'Ndiyo, tuma', no: 'Rudi' }).then(function (yes) { if (yes) holdReply(b, { ref: o.ref, ok: false, rn: rn, rp: rp }, '✏️ Mpokeaji amebadilishwa — wakala anatuma sasa'); }); };
    var cb = $('tCancel');
    if (cb) cb.onclick = function () {
      var b = this;
      ask({ icon: '🛑', title: 'Ghairi oda ' + o.ref + '?', text: omr(o.omr) + ' OMR kwa ' + (o.rn || 'mpokeaji') + '. Kama ulishalipa OMR, tutakurudishia.', ok: 'Ndiyo, ghairi', no: 'Acha', danger: true }).then(function (yes) { if (!yes) return;
      busy(b, true, 'Inaghairi…');
      api('w_cancel', { ref: o.ref }).then(function (j) { busy(b, false); if (!j.ok) return toast(j.msg || 'Imeshindikana');
        S.orders = S.orders.map(function (x) { return x.ref === o.ref ? j.order : x; }); LS.set('yzw_orders', S.orders); drawTrack(); toast('Oda imeghairiwa'); })
        .catch(function (e) { busy(b, false); toast(e.message); });
      });
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
      var rows = [['Mpokeaji', o.rn || '-'], [o.net || 'Mtandao / benki', o.rp || ''], ['Umetuma', omr(o.omr) + ' OMR · rate ' + tzs(o.rate)], ['Ref', o.ref], ['Imefika', when(o.paidAt || o.at)], ['Hali', 'IMELIPWA']];
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
  var LBL = {}; Object.keys(PILL).forEach(function (k) { LBL[k] = PILL[k][1]; });
  var OPEN_ST = { 'new': 1, ok: 1, hold: 1, part: 1, rchk: 1, rpay: 1, rno: 1 }, DONE_ST = { paid: 1, rdone: 1 }, BAD_ST = { no: 1, rstop: 1, cancel: 1, stop: 1, lost: 1, returned: 1, refunded: 1, used: 1 };   // zinaendelea · zilizofanikiwa · zilizositishwa
  function filtOk(o) {
    var f = S.filt;
    if (f === 'open') return !!OPEN_ST[o.st]; if (f === 'paid') return !!DONE_ST[o.st]; if (f === 'bad') return !!BAD_ST[o.st];
    if (f === 'rev') return o.dir === 'to'; if (f === 'bill') return o.kind === 'bill'; if (f === 'mobile') return o.dir !== 'to' && o.kind !== 'bill' && /^0[67]\d{8}$|^\d{4} •••|M-Pesa|Mixx|Airtel|Halo|T-Pesa|TTCL/i.test(String(o.net || '') + ' ' + String(o.rp || '')); if (f === 'bank') return o.dir !== 'to' && o.kind !== 'bill' && !/M-Pesa|Mixx|Airtel|Halo|T-Pesa|TTCL/i.test(String(o.net || ''));
    return true;
  }
  /* Taarifa ya hesabu ya mteja (PDF): miamala iliyofanyika kweli (zilizofika, pesa zilizorudi, refund, zilizositishwa bila kurudi, amana, malipo ya deni)
     kwa mpangilio wa muda, na salio/deni baada ya kila muamala — kutoka kwenye daftari la seva (kanuni zile zile za salio). Oda zilizokataliwa haziingii. */
  function dtLocal(t) { var d = new Date(t), z = function (n) { return ('0' + n).slice(-2); }; return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()); }
  function dtShort(t) { return new Date(t).toLocaleDateString('en-GB'); }
  /* kipindi maalum: tarehe ya kuanzia / kumalizia (siku nzima) */
  /* kitufe kimoja → karatasi kama ya Daftari: Siku / Wiki / Mwezi / Tarehe, na ‹ › kurudi nyuma. Kikomo kwa mteja: mwezi mmoja (siku 31), tarehe tu (bila saa). */
  var STX = { k: 'm', off: 0 };
  function stxRange(k, off) {
    var n = new Date(), d0 = new Date(n.getFullYear(), n.getMonth(), n.getDate()), f, t, l;
    if (k === 'd') { f = new Date(d0); f.setDate(f.getDate() + off); t = new Date(f); t.setDate(t.getDate() + 1); l = (off === 0 ? 'Leo · ' : off === -1 ? 'Jana · ' : '') + f.toLocaleDateString('en-GB'); }
    else if (k === 'w') { f = new Date(d0); f.setDate(f.getDate() - (f.getDay() + 6) % 7 + 7 * off); t = new Date(f); t.setDate(t.getDate() + 7); var e = new Date(t); e.setDate(e.getDate() - 1); l = (off === 0 ? 'Wiki hii · ' : '') + f.toLocaleDateString('en-GB') + ' – ' + e.toLocaleDateString('en-GB'); }
    else { f = new Date(n.getFullYear(), n.getMonth() + off, 1); t = new Date(f.getFullYear(), f.getMonth() + 1, 1); l = monthName(f); }
    return { from: f.getTime(), to: t.getTime(), label: l };
  }
  function stxDraw() {
    $('stx').querySelectorAll('#stxP button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-k') === STX.k); });
    var c = STX.k === 'c'; $('stxCustom').style.display = c ? 'flex' : 'none'; $('stxNav').style.display = c ? 'none' : 'flex'; $('stxErr').textContent = '';
    if (!c) { $('stxLbl').textContent = stxRange(STX.k, STX.off).label; $('stxNext').disabled = STX.off >= 0; $('stxNext').style.opacity = STX.off >= 0 ? '.35' : ''; }
  }
  function openStx(btn) {
    var now = Date.now(); $('stxFrom').value = dtLocal(now - 6 * 864e5); $('stxTo').value = dtLocal(now); $('stxFrom').max = $('stxTo').max = dtLocal(now);
    STX.k = 'm'; STX.off = 0; stxDraw(); $('stx').style.display = 'flex';
    $('stxClose').onclick = function () { $('stx').style.display = 'none'; }; $('stx').onclick = function (e) { if (e.target === $('stx')) $('stx').style.display = 'none'; };
    $('stxP').onclick = function (e) { var b = e.target.closest('[data-k]'); if (!b) return; STX.k = b.getAttribute('data-k'); STX.off = 0; stxDraw(); haptic(); };
    $('stxPrev').onclick = function () { STX.off--; stxDraw(); haptic(); };
    $('stxNext').onclick = function () { if (STX.off < 0) { STX.off++; stxDraw(); haptic(); } };
    $('stxGo').onclick = function () {
      if (STX.k !== 'c') { $('stx').style.display = 'none'; return statementPdf(stxRange(STX.k, STX.off), btn); }
      var f = new Date($('stxFrom').value + 'T00:00:00').getTime(), t = new Date($('stxTo').value + 'T00:00:00').getTime();
      if (!(f > 0) || !(t > 0)) return fail($('stxErr'), 'Weka tarehe zote mbili', $('stxFrom'));
      if (t < f) return fail($('stxErr'), '"Hadi" lazima iwe baada ya "Kuanzia"', $('stxTo'));
      if ((t - f) / 864e5 > 30.5) return fail($('stxErr'), 'Kipindi kisizidi siku 31 — chagua mwezi mmoja tu', $('stxTo'));
      $('stx').style.display = 'none'; statementPdf({ from: f, to: t + 864e5, label: dtShort(f) + ' – ' + dtShort(t) }, btn);
    };
  }
  function statementPdf(period, btn) {
    var p = period && typeof period === 'object' ? period : stxRange('m', 0), from = p.from, to = p.to, label = p.label;
    busy(btn, true, 'Inaandaa PDF…');
    api('w_statement', { from: from, to: to }).then(function (j) {
      if (!j.ok || !j.rows) throw new Error(j.msg || 'Taarifa haikupatikana — jaribu tena');
      var L = j.rows; if (!L.length) throw new Error('Hakuna miamala kwenye ' + label);
      var J = PDF(), doc = new J({ unit: 'mm', format: 'a4' }), W = 210, H = 297, me = S.me || {};
      var nSend = 0, tzsSent = 0, omrSent = 0, inn = 0, out = 0, back = 0;
      L.forEach(function (x) { if (x.kind === 'sale') { nSend++; tzsSent += x.tzs || 0; omrSent += x.out || 0; } if (x.kind === 'pay' || x.kind === 'open') inn += x.inn || 0; if (x.kind === 'refund') back += x.out || 0; if (x.kind === 'returned') back += 0; });
      var balEnd = L[L.length - 1].bal, balTxt = balEnd == null ? '—' : balEnd < -0.0005 ? 'Deni ' + omr(-balEnd) + ' OMR' : balEnd > 0.0005 ? 'Amana ' + omr(balEnd) + ' OMR' : '0 OMR';
      pdfHead(doc, W, 'Taarifa ya miamala na hesabu', label);
      doc.setTextColor(15, 42, 28); doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text(me.name || 'Mteja wa WakalaOnline', 12, 42);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(91, 107, 98);
      doc.text('+' + (me.phone || '') + '   ·   Imetolewa ' + new Date().toLocaleDateString('en-GB'), 12, 48);
      var box = function (x, t, v) { doc.setFillColor(238, 246, 220); doc.roundedRect(x, 54, 58, 20, 3, 3, 'F'); doc.setFontSize(8.5); doc.setTextColor(63, 90, 18); doc.text(t, x + 4, 61); doc.setFont('helvetica', 'bold'); doc.setFontSize(12.5); doc.setTextColor(15, 42, 28); doc.text(v, x + 4, 69); doc.setFont('helvetica', 'normal'); };
      box(12, 'Umetuma Tanzania', nSend + ' · ' + omr(omrSent) + ' OMR'); box(76, 'TZS zilizotumwa', tzs(tzsSent)); box(140, 'Salio mwisho wa kipindi', balTxt);
      var fmtBal = function (b) { return b == null ? '—' : b < -0.0005 ? 'Deni ' + omr(-b) : b > 0.0005 ? omr(b) : '0'; };
      doc.autoTable({
        startY: 82, margin: { left: 12, right: 12, bottom: 16 },
        head: [['Tarehe', 'Ref', 'Maelezo', 'TZS', 'Umelipa (OMR)', 'Imetoka (OMR)', 'Salio / Deni baada']],
        body: L.map(function (x) { return [new Date(x.at).toLocaleDateString('en-GB'), x.ref || '', x.desc || '', x.tzs ? tzs(x.tzs) : '', x.inn ? '+' + omr(x.inn) : '', x.out ? '-' + omr(x.out) : '', fmtBal(x.bal)]; }),
        styles: { font: 'helvetica', fontSize: 8, cellPadding: 2, textColor: [15, 42, 28], overflow: 'linebreak' },
        headStyles: { fillColor: [31, 122, 50], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [244, 246, 242] },
        columnStyles: { 0: { cellWidth: 18 }, 1: { cellWidth: 24 }, 2: { cellWidth: 66 }, 3: { halign: 'right', cellWidth: 18 }, 4: { halign: 'right', cellWidth: 20 }, 5: { halign: 'right', cellWidth: 20 }, 6: { halign: 'right' } },
        didParseCell: function (d) { if (d.section !== 'body') return; var k = L[d.row.index] && L[d.row.index].kind;
          if (d.column.index === 6) d.cell.styles.textColor = /^Deni/.test(String(d.cell.raw)) ? [180, 35, 24] : [23, 96, 42];
          if (d.column.index === 2) d.cell.styles.textColor = k === 'lost' || k === 'stop' ? [180, 35, 24] : k === 'returned' || k === 'refund' ? [138, 90, 11] : [15, 42, 28]; }
      });
      /* mwisho wa hesabu: muhtasari kwa kila mwezi (miamala, TZS, umelipa, imetoka, salio mwisho wa mwezi) */
      var MO = {}, MK = [];
      L.forEach(function (x) { var k = monKey(x.at); if (!MO[k]) { MO[k] = { n: 0, tzs: 0, inn: 0, out: 0, bal: null }; MK.push(k); } var m = MO[k]; if (x.kind === 'sale' || x.kind === 'rev') m.n++; m.tzs += x.tzs || 0; m.inn += x.inn || 0; m.out += x.out || 0; if (x.bal != null) m.bal = x.bal; });
      var y = doc.lastAutoTable.finalY + 10;
      if (MK.length) {
        if (y > H - 60) { doc.addPage(); y = 40; }
        doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(15, 42, 28); doc.text('Muhtasari kwa mwezi', 12, y); doc.setFont('helvetica', 'normal');
        doc.autoTable({
          startY: y + 4, margin: { left: 12, right: 12, bottom: 16 },
          head: [['Mwezi', 'Miamala', 'TZS', 'Umelipa (OMR)', 'Imetoka (OMR)', 'Salio / Deni mwisho wa mwezi']],
          body: MK.map(function (k) { var m = MO[k], d = new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, 1); return [monthName(d), String(m.n), tzs(m.tzs), omr(m.inn), omr(m.out), fmtBal(m.bal)]; }),
          styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2.2, textColor: [15, 42, 28] },
          headStyles: { fillColor: [63, 90, 18], textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [244, 246, 242] },
          columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right', fontStyle: 'bold' } },
          didParseCell: function (d) { if (d.section === 'body' && d.column.index === 5) d.cell.styles.textColor = /^Deni/.test(String(d.cell.raw)) ? [180, 35, 24] : [23, 96, 42]; }
        });
        y = doc.lastAutoTable.finalY + 6;
      }
      doc.setFontSize(8); doc.setTextColor(91, 107, 98);
      doc.text('Umelipa (OMR) = pesa uliyotoa / kuweka kwetu · Imetoka (OMR) = kiasi cha muamala au refund · Salio chanya = amana yako, "Deni" = unachodaiwa. Oda zilizokataliwa au kughairiwa haziingii.', 12, y, { maxWidth: W - 24 });
      pdfFoot(doc, W, H);
      var b64 = doc.output('datauristring').split(',')[1];
      return shareFile('WakalaOnline-Taarifa-' + label.replace(/[^\w\u00C0-\u024F-]+/g, '-').slice(0, 40) + '.pdf', b64, 'application/pdf', 'Taarifa ya miamala na hesabu · WakalaOnline · ' + label);
    }).catch(shareErr).then(function () { busy(btn, false); });
  }
  function monthName(d) { return ['Januari', 'Februari', 'Machi', 'Aprili', 'Mei', 'Juni', 'Julai', 'Agosti', 'Septemba', 'Oktoba', 'Novemba', 'Desemba'][d.getMonth()] + ' ' + d.getFullYear(); }


  /* ---------- historia ---------- */
  function drawHist() {
    var me = S.me || {};

    var b = Number(me.bal) || 0, showBal = Math.abs(b) > 0.0005 || !!me.canAmana;   // mteja mpya asiye na deni/amana haoni salio kabisa
    $('hiBalCard').style.display = showBal ? 'flex' : 'none'; $('hiBalCard').parentNode.style.gridTemplateColumns = showBal ? '' : '1fr';
    $('hiBalLbl').textContent = b < 0 ? 'Deni lako' : 'Salio lako'; $('hiPay').style.display = b < -0.0005 || (S.me && S.me.canAmana) ? 'flex' : 'none'; $('hiPay').textContent = b < -0.0005 ? '💳 Lipa deni' : '➕ Weka amana'; $('hiPay').style.borderColor = $('hiPay').style.color = b < -0.0005 ? 'var(--bad)' : '';
    $('hiBal').textContent = omr(Math.abs(b)) + ' OMR'; maskBal('hiBal');
    $('hiBal').style.color = b < 0 ? 'var(--bad)' : '';
    document.querySelectorAll('#hiFilt button').forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-f') === S.filt); });
    /* vichujio vya mwezi: miezi yote yenye miamala (mpya kwanza); 'Zote' = miezi yote */
    var mons = {}; S.orders.forEach(function (o) { if (o.at) { var d = new Date(o.at); mons[d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2)] = 1; } });
    var ML = Object.keys(mons).sort().reverse(); if (S.mon && !mons[S.mon]) S.mon = '';

    var P = hiRange(), L = S.orders.filter(function (o) { return filtOk(o) && (o.at || 0) >= P.from && (o.at || 0) < P.to; });
    hiPerDraw(P);
    var sent = 0; S.orders.forEach(function (o) { if (DONE_ST[o.st] && o.dir !== 'to' && (o.at || 0) >= P.from && (o.at || 0) < P.to) sent += Number(o.omr) || 0; });
    $('hiSentL').textContent = 'Umetuma · ' + P.label; $('hiMonth').textContent = omr(Math.round(sent * 1000) / 1000) + ' OMR'; maskBal('hiMonth');
    $('hiStBtn').textContent = '📄 Pakua PDF · ' + P.label;
    document.querySelectorAll('#hiStHint').forEach(function (x) { x.textContent = 'Miamala iliyofanyika na salio/deni baada ya kila moja'; });
    var pm = $('hiStMon'); if (pm) { var cur = monKey(Date.now()), lastD = new Date(); lastD.setMonth(lastD.getMonth() - 1); var showM = S.mon && S.mon !== cur && S.mon !== monKey(lastD.getTime()); pm.style.display = showM ? '' : 'none'; if (showM) pm.textContent = monShort(S.mon) + (S.mon.slice(0, 4) === String(new Date().getFullYear()) ? ' ' + S.mon.slice(0, 4) : ''); }
    $('hiList').innerHTML = L.length ? L.map(function (o) {
      if (o.dir === 'to') return '<button class="li" data-ref="' + esc(o.ref) + '"><span class="avs" style="background:#E3EAF7;color:#1B2E52">🇴🇲</span>'
        + '<span style="flex:1;display:flex;flex-direction:column;gap:2px;min-width:0"><span style="font-weight:800;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">Nunua Rial · ' + esc(o.rn || '') + '</span>'
        + '<span class="mut" style="font-size:12px">' + esc(o.ref) + ' · ' + esc(when(o.at)) + ' · umelipa TZS ' + tzs(o.tzs) + (o.net ? ' · ' + esc(o.net) : '') + '</span></span>'
        + '<span style="display:flex;flex-direction:column;align-items:flex-end;gap:4px"><span class="num" style="font-weight:700;font-size:14px;color:#1B2E52">+' + omr(o.omr) + ' OMR</span>' + pill(o) + '</span></button>';
      return '<button class="li" data-ref="' + esc(o.ref) + '"><span class="avs">' + esc(initials(o.rn)) + '</span>'
        + '<span style="flex:1;display:flex;flex-direction:column;gap:2px;min-width:0"><span style="font-weight:800;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(o.rn || 'Mpokeaji') + '</span>'
        + '<span class="mut" style="font-size:12px">' + esc(o.ref) + ' · ' + esc(when(o.at)) + (o.net ? ' · ' + esc(o.net) : '') + '</span></span>'
        + '<span style="display:flex;flex-direction:column;align-items:flex-end;gap:4px"><span class="num" style="font-weight:600;font-size:14px">' + omr(o.omr) + ' OMR</span>' + pill(o) + '</span></button>';
    }).join('') : (S.filt !== 'all' || HP.off || HP.k !== 'm' ? '<div class="empty">Hakuna miamala kwenye kichujio hiki.</div>' : '<div class="empty">Bado hakuna miamala hapa.<br>Bonyeza <b>Tuma</b> kuanza.</div>');
  }
  $('hiStBtn').onclick = function () { if ($('hiPerErr').textContent) return; statementPdf(hiRange(), this); };
  function monKey(t) { var d = new Date(t); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2); }
  function monOk(o) { return !S.mon || (o.at && monKey(o.at) === S.mon); }
  function monShort(m) { var M = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ago', 'Sep', 'Okt', 'Nov', 'Des'], y = m.slice(0, 4), k = +m.slice(5, 7) - 1; return M[k] + (y === String(new Date().getFullYear()) ? '' : ' ' + y); }
  /* kichujio kimoja cha historia na PDF: Siku / Wiki / Mwezi / Tarehe (‹ › kurudi nyuma). PDF inafuata kipindi hiki — kikomo mwezi mmoja, tarehe tu. */
  var HP = { k: 'm', off: 0, f: '', t: '' };
  function hiRange() {
    if (HP.k !== 'c') return stxRange(HP.k, HP.off);
    var f = new Date(HP.f + 'T00:00:00').getTime(), t = new Date(HP.t + 'T00:00:00').getTime();
    return { from: f, to: t + 864e5, label: dtShort(f) + ' – ' + dtShort(t), custom: 1 };
  }
  function hiPerDraw(P) {
    document.querySelectorAll('#hiPer button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-k') === HP.k); });
    var c = HP.k === 'c'; $('hiNav').style.display = c ? 'none' : 'flex'; $('hiCust').style.display = c ? 'grid' : 'none';
    if (!c) { $('hiPerL').textContent = P.label; $('hiNext').disabled = HP.off >= 0; $('hiNext').style.opacity = HP.off >= 0 ? '.35' : ''; }
  }
  $('hiPer').onclick = function (e) { var b = e.target.closest('[data-k]'); if (!b) return; HP.k = b.getAttribute('data-k'); HP.off = 0; $('hiPerErr').textContent = '';
    if (HP.k === 'c') { var now = Date.now(); HP.t = dtLocal(now); HP.f = dtLocal(now - 6 * 864e5); $('hiFrom').value = HP.f; $('hiTo').value = HP.t; $('hiFrom').max = $('hiTo').max = HP.t; }
    drawHist(); haptic(); };
  $('hiPrev').onclick = function () { HP.off--; drawHist(); haptic(); };
  $('hiNext').onclick = function () { if (HP.off < 0) { HP.off++; drawHist(); haptic(); } };
  ['hiFrom', 'hiTo'].forEach(function (id) { $(id).onchange = function () {
    var f = $('hiFrom').value, t = $('hiTo').value; $('hiPerErr').textContent = ''; if (!f || !t) return;
    if (t < f) return fail($('hiPerErr'), '"Hadi" lazima iwe baada ya "Kuanzia"', $('hiTo'));
    if ((new Date(t) - new Date(f)) / 864e5 > 30.5) return fail($('hiPerErr'), 'Kipindi kisizidi siku 31 — chagua mwezi mmoja tu', $('hiTo'));
    HP.f = f; HP.t = t; drawHist(); }; });
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
        + '<span style="font-size:12px;font-weight:700;color:var(--ok-ink);display:flex;align-items:center;gap:6px;flex-wrap:wrap">' + (had ? 'tayari kwenye orodha' : (r.n ? 'mara ' + r.n : 'mpya') + (r.t ? ' · mwisho ' + ago(r.t) : '')) + (r.ls && !had ? ' ' + pill({ st: r.ls }) : '') + '</span></span>'
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
    el.querySelector('.b-tz').textContent = o ? tzs(netT(o)) + ' TZS' : '';
    var tg = el.querySelector('.b-tg');
    if (!x.rp) tg.textContent = '';
    else if (x.net) tg.innerHTML = '<span style="color:' + (NETC[x.net] || 'var(--brand-2)') + '">●</span> ' + esc(x.net) + (x.manual ? '' : ' · imetambuliwa') + ' <button type="button" data-chg="' + k + '" style="background:none;border:none;color:var(--brand-2);font-weight:800;font-size:12px;cursor:pointer;padding:2px 4px">Badilisha</button>';
    else tg.innerHTML = '<span style="color:var(--warn)">' + (x.kind === 'mobile' ? 'Chagua mtandao' : 'Chagua benki ya akaunti hii') + '</span>';
    el.querySelector('.b-net').style.display = x.rp && (!x.net || x.manual) ? 'block' : 'none';
    el.classList.remove('bad');
  }
  function bTot() {
    var to = 0, tt = 0, n = 0;
    B.rows.forEach(function (x) { var o = Number(String(x.omr || '').replace(/,/g, '')) || 0; if (o) { to += o; tt += netT(o); n++; } });
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
    if (!B.proof) { $('bErr').textContent = 'Pakia risiti ya malipo ya jumla kwanza'; return; }
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
    apiLoad('w_batch', body, 'Inatuma oda za kundi…', '✓ Oda zimepokelewa').then(function (j) {
      busy(btn, false);
      if (!j.ok && j.error === 'twin') return ask({ icon: '👯', title: 'Oda inayofanana ipo', text: j.msg, ok: 'Endelea', no: 'Acha' }).then(function (yes) { if (yes) { body.again = 1; return bSubmit(body, btn); } $('cf').classList.remove('on'); if (j.row != null) bBad(j.row, j.msg); });
      if (!j.ok) {
        if (j.error === 'rate') { $('cf').classList.remove('on'); Promise.all([loadInfo(), loadMe()]).then(function () { bDraw(); $('bErr').textContent = j.msg; }); return; }
        if (j.row != null) { $('cf').classList.remove('on'); bBad(j.row, j.msg); return; }
        err.textContent = j.msg || 'Imeshindikana'; return;
      }
      $('cf').classList.remove('on'); $('cfT').textContent = 'Hakiki oda yako';
      B.rows = []; B.proof = ''; B.ck = ''; bSave(); $('bProof').value = ''; $('bProofImg').style.display = 'none'; $('bProofTxt').textContent = 'Pakia risiti ya malipo';
      if (!j.dup) { S.orders = (j.orders || []).slice().reverse().concat(S.orders); LS.set('yzw_orders', S.orders); }
      var tot = (j.orders || []).reduce(function (a, o) { return a + (o.tzs || 0); }, 0);
      S.stack = ['home'];
      $('okT').textContent = 'Oda ' + (j.orders || []).length + ' zimepokelewa!';
      $('okAmt').textContent = tzs(tot) + ' TZS';
      $('okTxt').textContent = 'Kundi ' + (j.bt || '') + ' · wapokeaji ' + (j.orders || []).length + '. Tunathibitisha malipo yako sasa — utapata taarifa pesa ikifika kwa kila mmoja.';
      $('okRef').textContent = j.bt || ''; $('ok').classList.add('on'); haptic();
      $('okTrack').textContent = 'Ona oda zote';
      $('okTrack').onclick = function () { $('ok').classList.remove('on'); $('okT').textContent = 'Oda imepokelewa!'; $('okTrack').textContent = 'Fuatilia oda'; S.stack = ['hist']; show('hist', false); };
      $('okHome').onclick = function () { $('ok').classList.remove('on'); $('okT').textContent = 'Oda imepokelewa!'; $('okTrack').textContent = 'Fuatilia oda'; S.stack = ['home']; show('home', false); };
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
    $('hDebtAmt').textContent = omr(red ? o : am) + ' OMR'; maskBal('hDebtAmt');
    var P = pendPays(), ps = P.reduce(function (a, p) { return a + p.omr; }, 0);
    $('hDebtPend').style.display = P.length ? 'inline-flex' : 'none'; $('hDebtPend').textContent = '⏳ ' + omr(ps) + ' OMR inahakikiwa';
  }
  function openPay(viaShare) {
    var o = owe(), am = amana(); PD.src = viaShare ? 'share' : '';
    if (!o && !viaShare && !(S.me && S.me.canAmana)) return toast('Kuweka amana kunahitaji ruhusa ya WakalaOnline — wasiliana nasi WhatsApp');
    var P = pendPays(), ps = Math.round(P.reduce(function (a, p) { return a + p.omr; }, 0) * 1000) / 1000, left = Math.max(0, Math.round((o - ps) * 1000) / 1000);
    $('pdT').textContent = o ? '💳 Lipa deni' : viaShare ? '🏦 Weka kama amana' : '➕ Weka amana';
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
    if (!(a >= 0.5)) return fail(err, 'Weka kiasi unacholipa', $('pdAmt'));
    if (!PD.proof) return fail(err, 'Pakia risiti ya malipo yako', $('pdProofTxt').parentNode);
    if (!PD.ck) PD.ck = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    busy(btn, true, 'Inatuma…');
    apiLoad('w_paydebt', { omr: a, img: PD.proof, ck: PD.ck, src: PD.src || '' }, 'Inatuma malipo…', '✓ Malipo yamepokelewa').then(function (j) {
      busy(btn, false); if (!j.ok) { err.textContent = j.msg || 'Imeshindikana'; return; }
      setMe(j); PD.proof = ''; PD.ck = ''; $('pdProof').value = ''; $('pdProofImg').style.display = 'none'; $('pdProofTxt').textContent = 'Pakia risiti ya malipo';
      $('pd').classList.remove('on'); haptic(); toast(PD.src === 'share' && !owe() ? '✓ Amana ya ' + omr(a) + ' OMR imetumwa — ikithibitishwa, tuma mpokeaji ulipe kwa salio' : '✓ Malipo ya ' + omr(a) + ' OMR yametumwa — utapata taarifa yakithibitishwa'); PD.src = '';
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
    var me = S.me || {}; drawPrefs();
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
  $('aOut').onclick = function () { ask({ icon: '👋', title: 'Toka (Logout)?', text: 'Utahitaji code ya WhatsApp kuingia tena. Oda zako zinabaki.', ok: 'Logout', no: 'Baki', danger: true }).then(function (yes) { if (yes) logout(); }); };

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

  /* ---------- MIPANGILIO ya mteja: usalama tu ---------- */
  function hideOn() { return !!LS.get('yzw_hide', 0); }
  function drawPrefs() { $('pPin').checked = !!LS.get('yzw_pin', null); $('pHide').checked = hideOn(); }
  $('pHide').onchange = function () { LS.set('yzw_hide', this.checked ? 1 : 0); S.reveal = false; toast(this.checked ? '✓ Salio limefichwa — gusa kuona' : '✓ Salio linaonekana'); };
  $('pPin').onchange = function () { var me = this; if (me.checked) { me.checked = false; pinSetup(function (ok) { me.checked = ok; }); } else ask({ icon: '🔓', title: 'Ondoa kufuli ya app?', ok: 'Ondoa', no: 'Acha' }).then(function (y) { if (y) { LS.del('yzw_pin'); toast('Kufuli imeondolewa'); } else me.checked = true; }); };
  $('pOutAll').onclick = function () { ask({ icon: '📵', title: 'Toka kwenye simu zote?', text: 'Simu zote zilizoingia kwa namba yako zitatolewa — pamoja na hii. Utaingia tena kwa code ya WhatsApp.', ok: 'Toka zote', no: 'Acha', danger: true }).then(function (y) { if (!y) return;
    api('w_logoutall', {}).then(function (j) { if (!j.ok) return toast(j.msg || 'Imeshindikana'); LS.del('yzw_pin'); logout(true); toast('✓ Umetoka kwenye simu zote'); }).catch(function (e) { toast(e.message); }); }); };
  /* kufuli ya PIN (ndani ya simu hii tu) */
  function pinHash(pin, salt) { var h = 2166136261, str = salt + '|' + pin; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(16) + '.' + str.length; }
  var LK = { mode: '', buf: '', first: '', fails: 0, cb: null };
  function lockDots() { var d = $('lockD').querySelectorAll('i'); for (var i = 0; i < 4; i++) d[i].classList.toggle('on', i < LK.buf.length); }
  function lockOpen(mode, cb) { LK.mode = mode; LK.buf = ''; LK.first = ''; LK.fails = 0; LK.cb = cb || null; $('lockErr').textContent = ''; lockDots();
    $('lockT').textContent = mode === 'set' ? 'Weka PIN mpya' : 'Weka PIN yako'; $('lockS').textContent = mode === 'set' ? 'Tarakimu 4 — utaziweka ukifungua app' : 'WakalaOnline';
    $('lockForgot').style.display = mode === 'verify' ? '' : 'none'; $('lockCancel').style.display = mode === 'set' ? '' : 'none'; $('lock').classList.add('on'); }
  function lockClose() { $('lock').classList.remove('on'); }
  function pinSetup(cb) { lockOpen('set', cb); }
  function lockNeeded() { return !!(S.wt && LS.get('yzw_pin', null)); }
  function lockNow() { if (lockNeeded() && !$('lock').classList.contains('on')) lockOpen('verify'); }
  $('lockPad').onclick = function (e) { var b = e.target.closest('button'); if (!b || b.getAttribute('data-k') === 'x') return; haptic();
    if (b.getAttribute('data-k') === 'del') { LK.buf = LK.buf.slice(0, -1); lockDots(); return; }
    if (LK.buf.length >= 4) return; LK.buf += b.textContent.trim(); lockDots(); if (LK.buf.length < 4) return;
    var pin = LK.buf;
    if (LK.mode === 'set') {
      if (!LK.first) { LK.first = pin; LK.buf = ''; setTimeout(function () { lockDots(); $('lockT').textContent = 'Rudia PIN'; $('lockS').textContent = 'Andika PIN ile ile tena'; }, 150); return; }
      if (pin !== LK.first) { LK.first = ''; LK.buf = ''; $('lockT').textContent = 'Weka PIN mpya'; $('lockS').textContent = 'Tarakimu 4'; fail($('lockErr'), 'PIN hazikufanana — anza tena', $('lockD')); setTimeout(lockDots, 300); return; }
      var salt = Math.random().toString(36).slice(2, 10); LS.set('yzw_pin', { s: salt, h: pinHash(pin, salt) }); lockClose(); toast('🔐 Kufuli imewashwa'); if (LK.cb) LK.cb(true); return;
    }
    var k = LS.get('yzw_pin', null);
    if (k && pinHash(pin, k.s) === k.h) { LK.fails = 0; LS.set('yzw_bgAt', 0); lockClose(); return; }
    LK.fails++; LK.buf = ''; fail($('lockErr'), LK.fails >= 5 ? 'PIN si sahihi mara ' + LK.fails + '. Umesahau? Ingia upya kwa WhatsApp.' : 'PIN si sahihi', $('lockD')); setTimeout(lockDots, 300);
  };
  $('lockCancel').onclick = function () { lockClose(); if (LK.cb) LK.cb(false); };
  $('lockForgot').onclick = function () { ask({ icon: '🔓', title: 'Ingia upya?', text: 'Kufuli itaondolewa na utaingia tena kwa code ya WhatsApp. Oda zako zinabaki.', ok: 'Ndiyo, ingia upya', no: 'Rudi' }).then(function (y) { if (!y) return; LS.del('yzw_pin'); lockClose(); logout(true); }); };
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { if (lockNeeded()) LS.set('yzw_bgAt', Date.now()); return; }
    var at = LS.get('yzw_bgAt', 0); if (lockNeeded() && at && Date.now() - at > 2 * 60000) lockNow();
  });
  /* ficha salio: '••••' mpaka aguse */
  function maskBal(id) { var el = $(id); if (!el || !hideOn() || S.reveal) return; el.textContent = '••••'; el.style.cursor = 'pointer'; el.title = 'Gusa kuona'; el.onclick = function (e) { e.stopPropagation(); S.reveal = true; var on = document.querySelector('.scr.on'); if (on && on.id === 's-home') drawHome(); if (on && on.id === 's-hist') drawHist(); }; }
  /* ---------- kuanza ---------- */
  var lp = LS.get('yzw_lastphone', null); if (lp) { $('lgCc').value = lp.cc; $('lgPhone').value = lp.raw; }
  function drawLoginRate() { var i = S.info, el = $('loginRate'); if (i && i.rate) { el.style.display = 'inline-flex'; el.querySelector('span').textContent = 'Rate ya sasa: 1 OMR = ' + tzs(i.rate) + ' TZS'; } }
  if (S.wt) {
    S.stack = ['home']; show('home', false); lockNow();
    Promise.all([loadMe(), loadOrders()]).then(function () { if (S.wt) drawHome(); pushInit(); });
  } else {
    S.stack = ['login']; show('login', false); drawLoginRate(); loadInfo().then(drawLoginRate);
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden && S.wt) Promise.all([loadInfo(), loadOrders()]).then(function () { var on = document.querySelector('.scr.on'); if (on && on.id === 's-home') drawHome(); if (on && on.id === 's-track') drawTrack(); }); });
})();
