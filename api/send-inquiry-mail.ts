// /api/send-inquiry-mail  (Vercel Serverless, Node)
// 상담 접수 알림 메일 발송 전용. 관리 프로그램 전달은 하지 않음 (Firebase sync 방식).
//
// Vercel 환경변수: GMAIL_USER, GMAIL_APP_PASSWORD, NOTIFY_TO
// 사이트별로 바꾸는 곳은 아래 두 상수뿐.

import nodemailer from 'nodemailer';

const ALLOWED_ORIGINS = [
  'https://www.hnaro.co.kr',
  'https://hnaro.co.kr'
];
const ALLOWED_RECIPIENT = 'alnetreport@gmail.com';

const SITE_LABEL = '하나로';
const RATE_LIMIT = 10;            // IP당 1분에 10회
const RATE_WINDOW_MS = 60_000;
const MAX_FIELD = 2000;

type Req = { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown; socket?: { remoteAddress?: string } };
type Res = { status(code: number): Res; json(body: unknown): void; setHeader(name: string, value: string): void; end(): void };

// ---- 보안 ----
const hits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some(t => now - t < RATE_WINDOW_MS)) hits.delete(k);
  return list.length > RATE_LIMIT;
}

const ATTACK = [
  /<\s*script/i, /javascript\s*:/i, /on\w+\s*=/i, /<\s*iframe/i, /<\s*img[^>]*src/i,      // XSS
  /\bunion\b[\s\S]*\bselect\b/i, /\b(drop|truncate|alter)\s+table\b/i, /;\s*--/, /'\s*or\s+'?1'?\s*=\s*'?1/i, // SQLi
  /[\r\n]\s*(to|cc|bcc|from|subject|content-type)\s*:/i, /%0[ad]/i,                         // CRLF / 헤더 주입
  /\$\{\s*jndi\s*:/i                                                                     // log4j
];
const FORBIDDEN_KEYS = ['to', 'cc', 'bcc', 'replyTo', 'reply_to', 'from', 'headers', 'attachments', 'subject', 'html', 'text'];

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || '';
const str = (v: unknown, max = MAX_FIELD) => (v == null ? '' : String(v)).slice(0, max);
const oneLine = (v: unknown, max = 200) => str(v, max).replace(/[\r\n]+/g, ' ');
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function hasAttack(body: Record<string, unknown>): boolean {
  return Object.values(body).some(v => typeof v === 'string' && ATTACK.some(re => re.test(v)));
}

// ---- 핸들러 ----
export default async function handler(req: Req, res: Res) {
  const origin = first(req.headers.origin);
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') { res.status(ALLOWED_ORIGINS.includes(origin) ? 204 : 403).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'POST only' });
  if (!ALLOWED_ORIGINS.includes(origin)) return res.status(403).json({ success: false, error: 'forbidden origin' });

  const ip = first(req.headers['x-forwarded-for']).split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
  if (rateLimited(ip)) return res.status(429).json({ success: false, error: 'too many requests' });

  let body: Record<string, unknown>;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : ((req.body as Record<string, unknown>) || {});
    if (typeof body !== 'object' || Array.isArray(body)) throw new Error('bad');
  } catch { return res.status(400).json({ success: false, error: 'bad json' }); }

  // Honeypot: 사람 눈에 안 보이는 website 칸이 채워져 있으면 봇. 성공한 척 조용히 종료
  if (str(body.website).trim()) return res.status(200).json({ success: true });

  // Open-relay 방지: 받는 사람/헤더/첨부를 요청으로 바꾸려는 시도 차단
  if (FORBIDDEN_KEYS.some(k => k in body)) return res.status(400).json({ success: false, error: 'forbidden field' });
  if (hasAttack(body)) return res.status(400).json({ success: false, error: 'blocked' });

  const phone = str(body.phone, 20).replace(/[^0-9]/g, '');
  if (!/^01[016789][0-9]{7,8}$/.test(phone)) return res.status(400).json({ success: false, error: 'invalid phone' });
  const phoneHyphen = phone.replace(/(\d{3})(\d{3,4})(\d{4})/, '$1-$2-$3');

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return res.status(500).json({ success: false, error: 'mail not configured' });
  // 받는 사람은 항상 고정값. NOTIFY_TO가 다르게 설정돼 있어도 ALLOWED_RECIPIENT로만 보냄
  const to = ALLOWED_RECIPIENT;

  const rows: [string, string][] = [
    ['접수 경로', oneLine(body.source)],
    ['이름', oneLine(body.name, 50) || '(미입력)'],
    ['연락처', phoneHyphen],
    ['통신사', oneLine(body.carrier) || '-'],
    ['가입 조건', oneLine(body.productCondition) || '-'],
    ['인터넷', oneLine(body.internetSpeed) || '-'],
    ['TV', oneLine(body.tvProduct) || '-'],
    ['결합할인', oneLine(body.bundleDiscount) || '-'],
    ['예상 월요금', oneLine(body.estimatedMonthly) || '-'],
    ['문의 내용', str(body.message) || '(없음)'],
    ['유입 페이지', oneLine(body.pageUrl, 500)],
    ['이전 페이지', oneLine(body.referrer, 500) || '-'],
    ['utm_source', oneLine(body.utm_source) || '-'],
    ['nclid', oneLine(body.nclid) || '-'],
    ['gclid', oneLine(body.gclid) || '-'],
    ['접수 시각', new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })]
  ];
  const html = `<div style="font-family:sans-serif"><h2 style="margin:0 0 14px;font-size:18px">${SITE_LABEL} 상담 접수</h2><table style="border-collapse:collapse;font-size:14px">${rows.map(([k, v]) => `<tr><td style="padding:7px 16px 7px 0;color:#64748b;white-space:nowrap;vertical-align:top">${k}</td><td style="padding:7px 0;font-weight:600">${esc(v).replace(/\n/g, '<br>')}</td></tr>`).join('')}</table></div>`;
  const subject = `[${SITE_LABEL}] 상담신청 - ${oneLine(body.name, 30) || '무기명'} ${phoneHyphen}`;

  try {
    const t = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
    await t.sendMail({ from: `"${SITE_LABEL} 상담알림" <${user}>`, to, subject, html });
    return res.status(200).json({ success: true });
  } catch (e) {
    console.error('mail error', e instanceof Error ? e.message : e);
    return res.status(500).json({ success: false, error: 'send failed' });
  }
}
