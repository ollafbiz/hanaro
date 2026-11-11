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
