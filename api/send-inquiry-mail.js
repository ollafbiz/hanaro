// Vercel 서버 함수: 상담 접수 → (1) 관리자 메일 알림 + (2) 사무실 관리 프로그램(API)으로 전달
// 위치: 프로젝트 루트의 api/send-inquiry-mail.js  →  주소: POST /api/send-inquiry-mail
// 필요 패키지: nodemailer  (package.json의 dependencies에 추가)
//
// Vercel 환경변수 (Settings → Environment Variables)
//   GMAIL_USER          알림을 보내는 지메일 주소
//   GMAIL_APP_PASSWORD  그 지메일의 '앱 비밀번호' 16자리 (일반 비밀번호 아님)
//   NOTIFY_TO           알림 받을 메일 (여러 개면 쉼표로)
//   SITE_NAME           메일 제목/본문에 들어갈 사이트 이름 (예: 올픽)
//   SITE_ID             관리 프로그램에서 사이트 구분용 코드 (예: allpick)
//   OFFICE_API_URL      사무실 관리 프로그램 접수 주소 (없으면 전달 건너뜀)
//   OFFICE_API_KEY      그 프로그램이 확인하는 키 (X-Ollaf-Key 헤더로 보냄)

const nodemailer = require('nodemailer');

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const str = (v) => (v == null ? '' : String(v));
const SITE_NAME = process.env.SITE_NAME || '사이트';
const SITE_ID = process.env.SITE_ID || 'site';

// (2) 사무실 관리 프로그램으로 접수 전달
async function forwardToOffice(b, phoneHyphen) {
  const url = process.env.OFFICE_API_URL || process.env.OLLAF_API_URL;
  const key = process.env.OFFICE_API_KEY || process.env.OLLAF_API_KEY;
  if (!url) return { skipped: true };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, key ? { 'X-Ollaf-Key': key } : {}),
      body: JSON.stringify({
        name: str(b.name),
        phone: phoneHyphen,
        carrier: str(b.carrier),
        serviceType: str(b.serviceType || b.source || '상담신청'),
        serviceDetail: str(b.serviceDetail || b.interest || '(선택 상품 없음)'),
        memo: str(b.memo),
        site: SITE_ID
      }),
      signal: ctrl.signal
    });
    return { ok: r.ok, status: r.status };
  } catch (e) {
    console.error('office api error', e && e.message);
    return { ok: false, error: e && e.message };
  } finally { clearTimeout(timer); }
}

// (1) 관리자 메일 알림
async function sendMail(b, phoneHyphen) {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  const to = process.env.NOTIFY_TO || process.env.MAIL_TO;
  if (!user || !pass || !to) return { ok: false, error: 'Missing mail env (GMAIL_USER / GMAIL_APP_PASSWORD / NOTIFY_TO)' };
  const rows = [
    ['접수 경로', b.source], ['이름', b.name || '(미입력)'], ['연락처', phoneHyphen],
    ['통신사', b.carrier || '-'], ['선택 상품', b.serviceDetail || b.interest || '-'], ['문의 내용', b.memo || b.message || '(없음)'],
    ['유입 페이지', b.pageUrl], ['이전 페이지', b.referrer || '-'], ['utm_source', b.utm_source || '-'],
    ['접수 시각', new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })]
  ];
  const html = `<div style="font-family:sans-serif"><h2 style="margin:0 0 14px;font-size:18px">${esc(SITE_NAME)} 상담 접수</h2><table style="border-collapse:collapse;font-size:14px">${rows.map(r => `<tr><td style="padding:7px 16px 7px 0;color:#64748b;white-space:nowrap;vertical-align:top">${r[0]}</td><td style="padding:7px 0;font-weight:600">${esc(r[1]).replace(/\n/g, '<br>')}</td></tr>`).join('')}</table></div>`;
  try {
    const t = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
    await t.sendMail({ from: `"${SITE_NAME} 상담알림" <${user}>`, to, subject: `[${SITE_NAME}] 상담신청 - ${b.name || '무기명'} ${phoneHyphen}`, html });
    return { ok: true };
  } catch (e) {
    console.error('mail error', e);
    return { ok: false, error: 'send failed' };
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'POST only' });

  let b;
  try { b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); }
  catch (e) { return res.status(400).json({ success: false, error: 'bad json' }); }

  const phone = String(b.phone || '').replace(/[^0-9]/g, '');
  if (!/^01[016789][0-9]{7,8}$/.test(phone)) return res.status(400).json({ success: false, error: 'invalid phone' });
  if (b.consent !== true) return res.status(400).json({ success: false, error: 'consent required' });
  const phoneHyphen = phone.replace(/(\d{3})(\d{3,4})(\d{4})/, '$1-$2-$3');

  const [mail, office] = await Promise.all([sendMail(b, phoneHyphen), forwardToOffice(b, phoneHyphen)]);
  return res.status(mail.ok || office.ok ? 200 : 500).json({ success: !!(mail.ok || office.ok), mail, office });
};
