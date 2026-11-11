/* 하나로 - 경량 템플릿 런타임 ({{값}}, sc-if, sc-for, setState) */
(function () {
  'use strict';
  var EV = { onclick: 'click', oninput: 'input', onchange: 'change', onsubmit: 'submit', onclickcapture: 'click' };

  function DCLogic() { this.props = {}; this.state = undefined; }
  DCLogic.prototype.setState = function (p) {
    var next = typeof p === 'function' ? p(this.state || {}) : p;
    this.state = Object.assign({}, this.state || {}, next);
    if (this.__dc) this.__dc.schedule();
  };
  window.DCLogic = DCLogic;

  function get(ctx, path) {
    return path.trim().split('.').reduce(function (o, k) { return o == null ? o : o[k]; }, ctx);
  }
  function holeOf(s) { var m = /^\s*\{\{([^}]+)\}\}\s*$/.exec(s); return m ? m[1] : null; }
  function sub(s, ctx) {
    return s.replace(/\{\{([^}]+)\}\}/g, function (_, k) {
      var v = get(ctx, k);
      return typeof v === 'function' || v == null ? '' : String(v);
    });
  }
  function bind(el) {
    if (!el.__h) return;
    el.__reg = el.__reg || {};
    Object.keys(el.__h).forEach(function (ev) {
      if (el.__reg[ev]) return;
      el.__reg[ev] = true;
      el.addEventListener(ev, function (e) { var f = el.__h && el.__h[ev]; if (f) f.call(el, e); }, ev === 'click' && el.__cap);
    });
  }

  function expand(node, ctx, out) {
    for (var ch = node.firstChild; ch; ch = ch.nextSibling) {
      if (ch.nodeType === 3) { out.appendChild(document.createTextNode(sub(ch.nodeValue, ctx))); continue; }
      if (ch.nodeType !== 1) continue;
      var tag = ch.tagName;
      if (ch.getAttribute('data-review-toggle')) continue;
      if (tag === 'SC-IF') {
        var h = holeOf(ch.getAttribute('value') || '');
        if (h && get(ctx, h)) expand(ch, ctx, out);
        continue;
      }
      if (tag === 'SC-FOR') {
        var list = get(ctx, holeOf(ch.getAttribute('list')) || '') || [];
        var as = ch.getAttribute('as');
        for (var i = 0; i < list.length; i++) {
          var c2 = Object.create(ctx); c2[as] = list[i]; c2.index = i;
          expand(ch, c2, out);
        }
        continue;
      }
      var el = ch.cloneNode(false);
      for (var a = 0; a < ch.attributes.length; a++) {
        var n = ch.attributes[a].name, v = ch.attributes[a].value;
        if (n.indexOf('hint-') === 0) { el.removeAttribute(n); continue; }
        var ev = EV[n.toLowerCase()];
        if (ev) {
          el.removeAttribute(n);
          var fn = get(ctx, holeOf(v) || '');
          if (typeof fn === 'function') {
            el.__h = el.__h || {}; el.__h[ev] = fn;
            if (/capture$/i.test(n)) el.__cap = true;
          }
          continue;
        }
        var whole = holeOf(v);
        if (whole !== null) {
          var val = get(ctx, whole);
          if (val === false || val == null) { el.removeAttribute(n); continue; }
          if (val === true) val = /^(aria|data)-/.test(n) ? 'true' : '';
          el.setAttribute(n, String(val));
        } else el.setAttribute(n, sub(v, ctx));
      }
      bind(el);
      expand(ch, ctx, el);
      out.appendChild(el);
    }
    return out;
  }

  function syncAttrs(t, s) {
    for (var i = t.attributes.length - 1; i >= 0; i--) {
      var n = t.attributes[i].name;
      if (!s.hasAttribute(n)) t.removeAttribute(n);
    }
    for (var j = 0; j < s.attributes.length; j++) {
      var a = s.attributes[j];
      if (t.getAttribute(a.name) !== a.value) t.setAttribute(a.name, a.value);
    }
  }
  function morph(t, s) {
    var tc = t.childNodes, sc = s.childNodes, i = 0;
    for (; i < sc.length; i++) {
      var a = tc[i], b = sc[i];
      if (!a) { t.appendChild(b.cloneNode(true)); bindDeep(t.lastChild, b); i--; continue; }
      if (a.nodeType === 3 && b.nodeType === 3) { if (a.nodeValue !== b.nodeValue) a.nodeValue = b.nodeValue; continue; }
      if (a.nodeType === 1 && b.nodeType === 1 && a.tagName === b.tagName) {
        syncAttrs(a, b);
        a.__h = b.__h; a.__cap = b.__cap; bind(a);
        morph(a, b);
        if ((a.tagName === 'INPUT' || a.tagName === 'TEXTAREA') && b.hasAttribute('value') && a.type !== 'checkbox' && a.type !== 'radio') {
          var want = b.getAttribute('value');
          if (a.value !== want) a.value = want;
        }
        continue;
      }
      var nn = b.cloneNode(true);
      bindDeep(nn, b);
      t.replaceChild(nn, a);
    }
    while (t.childNodes.length > sc.length) t.removeChild(t.lastChild);
  }
  // cloneNode does not copy listeners: re-attach from the source tree
  function bindDeep(clone, src) {
    if (src.nodeType !== 1) return;
    clone.__h = src.__h; clone.__cap = src.__cap; bind(clone);
    for (var i = 0; i < src.childNodes.length; i++) bindDeep(clone.childNodes[i], src.childNodes[i]);
  }

  // ---- 상담 접수 (inquiry.js 를 필요할 때만 불러옴) ----
  window.submitInquiry = function (p) { return import('/inquiry.js').then(function (m) { return m.submitInquiry(p); }); };
  // 모든 휴대폰 입력칸 자동 하이픈 (010-0000-0000)
  document.addEventListener('input', function (e) {
    var t = e.target; if (!t || t.tagName !== 'INPUT' || t.type !== 'tel') return;
    var d = t.value.replace(/\D/g, '').slice(0, 11);
    var v = d.length < 4 ? d : d.length < 8 ? d.slice(0, 3) + '-' + d.slice(3) : d.slice(0, 3) + '-' + d.slice(3, d.length - 4) + '-' + d.slice(-4);
    if (t.value !== v) t.value = v;
  });
  // 핸들러가 없는 '신청' 버튼(인터넷 상담·견적신청 폼)을 공통 처리
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('button');
    if (!b || b.__h || b.type !== 'button' || !/신청/.test(b.textContent)) return;
    var f = b.closest('form'); if (!f) return;
    e.preventDefault();
    var tel = f.querySelector('input[type=tel]'), name = f.querySelector('input[autocomplete=name]'), memo = f.querySelector('textarea'), car = f.querySelector('select'), ag = f.querySelector('input[type=checkbox]');
    var phone = tel ? tel.value.replace(/\D/g, '') : '';
    if (!/^01[016789][0-9]{7,8}$/.test(phone)) { alert('휴대폰 번호를 정확히 입력해주세요.'); return; }
    if (ag && !ag.checked) { alert('개인정보 수집·이용에 동의해주세요.'); return; }
    var title = (f.closest('article,section') || document).querySelector('strong,h2');
    var p = { source: (document.title.split('|')[0] || '').trim() + ' 상담신청', name: name ? name.value.trim() : '', phone: tel.value, memo: memo ? memo.value.trim() : '',
      carrier: car && car.value && car.value !== '선택해 주세요' ? car.value : '', detail: window.__inqDetail || (title ? title.textContent.trim() : ''), consent: true };
    b.disabled = true;
    window.submitInquiry(p).catch(function (err) { console.error(err); });
    alert('상담신청이 완료되었습니다.');
    f.reset(); if (ag) ag.checked = true; b.disabled = false;
    if (window.__dc && window.__dc.state && window.__dc.state.phone) window.__dc.setState({ phone: '' });
  });

  window.DC = {
    mount: function (Comp) {
      var tpl = document.getElementById('dc-tpl');
      var root = document.getElementById('app');
      var propsDef = {};
      try {
        var meta = JSON.parse(root.getAttribute('data-props') || '{}');
        Object.keys(meta).forEach(function (k) { if (meta[k] && meta[k].default !== undefined) propsDef[k] = meta[k].default; });
      } catch (e) {}
      var inst = new Comp();
      inst.props = propsDef;
      var pending = false;
      var dc = inst.__dc = {
        render: function () {
          pending = false;
          var vals = inst.renderVals();
          var frag = expand(tpl.content, vals, document.createElement('div'));
          morph(root, frag);
        },
        schedule: function () {
          if (pending) return; pending = true;
          (window.requestAnimationFrame || setTimeout)(function () { dc.render(); });
        }
      };
      dc.render();
      if (inst.componentDidMount) inst.componentDidMount();
      window.addEventListener('pagehide', function () { if (inst.componentWillUnmount) inst.componentWillUnmount(); });
      window.__dc = inst;
    }
  };
})();
