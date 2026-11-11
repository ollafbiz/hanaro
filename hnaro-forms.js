// 하나로 상담/견적/계약인증 폼 → Firestore 저장 + 알림 메일
// 모든 페이지에서 불러옴. 화면은 디자인 런타임이 그리므로, 버튼 클릭을 문서 단위로 받아서 처리함.
import { submitInquiry, isPhone, fmtPhone } from '/hnaro-inquiry.js';

let lastSent = 0;

// 동의 체크박스는 기본 체크 상태로 표시 (디자인 런타임이 checked 속성을 반영하지 않아서 보정)
function checkConsents(root) {
  (root.querySelectorAll ? root : document).querySelectorAll('form input[type="checkbox"]:not([data-hn-init])').forEach((b) => {
    b.setAttribute('data-hn-init', '1');
    b.checked = true;
  });
}
// 디자인 런타임이 화면을 다시 그리면 새 체크박스가 생기므로 주기적으로 확인 (이미 처리한 칸은 건드리지 않음)
checkConsents(document);
setInterval(() => checkConsents(document), 400);
const val = (el) => (el && el.value ? String(el.value).trim() : '');

// 전화번호 자동 하이픈 (디자인 쪽에서 이미 처리하는 칸은 그대로 둠)
document.addEventListener('input', (e) => {
  const t = e.target;
  if (t && t.matches && t.matches('input[type="tel"]') && !t.hasAttribute('maxlength')) {
    const v = fmtPhone(t.value);
    if (v !== t.value) t.value = v;
  }
}, true);

document.addEventListener('click', (e) => {
  const btn = e.target && e.target.closest ? e.target.closest('button') : null;
  if (!btn) return;
  const form = btn.closest('form');
  if (!form || form.getAttribute('role') === 'search') return;
  const tel = form.querySelector('input[type="tel"]');
  if (!tel) return;

  const isReview = !!form.querySelector('input[type="date"]');
  const texts = [...form.querySelectorAll('input[type="text"]')];
  const nameEl = form.querySelector('input[autocomplete="name"]') || texts[0];
  const name = val(nameEl);
  const memo = val(form.querySelector('textarea'));
  const boxes = [...form.querySelectorAll('input[type="checkbox"]')];
  const agreed = boxes.every((b) => b.checked);
  const phone = tel.value;

  if (isReview) {
    // 계약 인증: 화면의 안내(빨간 문구)는 디자인 쪽이 띄움. 조건이 다 맞을 때만 전송
    const date = val(form.querySelector('input[type="date"]'));
    const company = val(texts.find((t) => t !== nameEl));
    if (!name || !date || !company || !isPhone(phone) || !agreed) return;
    if (Date.now() - lastSent < 3000) return;
    lastSent = Date.now();
    submitInquiry({
      name, phone, consent: true, website: '',
      message: ['[계약 인증]', '이용업체: ' + company, '가입(이용)일: ' + date, memo ? '내용: ' + memo : ''].filter(Boolean).join('\n')
    }).catch((err) => console.error('inquiry', err));
    return;
  }

  e.preventDefault();
  if (!isPhone(phone)) { alert('휴대폰 번호를 정확히 입력해주세요. (예: 010-1234-5678)'); return; }
  if (!agreed) { alert('개인정보 수집·이용에 동의해주세요.'); return; }
  if (Date.now() - lastSent < 3000) return;
  lastSent = Date.now();

  const sel = (location.pathname.indexOf('/compare') === 0 && window.__hnSel) || {};
  submitInquiry(Object.assign({}, sel, {
    name, phone, message: memo, consent: true, website: ''
  })).catch((err) => console.error('inquiry', err));

  alert('상담 신청이 접수되었습니다. 빠르게 연락드리겠습니다.');
  if (nameEl && !nameEl.hasAttribute('value')) nameEl.value = '';
  const ta = form.querySelector('textarea');
  if (ta && !ta.hasAttribute('value')) ta.value = '';
}, true);
