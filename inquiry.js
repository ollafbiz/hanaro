// 브라우저용: 상담 접수 한 번에
//   (1) /api/send-inquiry-mail 호출 → 메일 알림 + 사무실 관리 프로그램 전달
//   (2) Firebase Firestore 'consultations' 컬렉션에 저장 → 관리자 사이트(문의관리)에서 조회
// 사용법: <script type="module"> import { submitInquiry } from './inquiry.js'; ... </script>

// ===== 프로젝트마다 바꿀 값 =====
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDzLPMQBSH1-Lx_TQth0p04ZiwruQepqZg',
  authDomain: 'hanaro-ffa2e.firebaseapp.com',
  projectId: 'hanaro-ffa2e',
  storageBucket: 'hanaro-ffa2e.firebasestorage.app',
  messagingSenderId: '836869189966',
  appId: '1:836869189966:web:8868ffc5c881d9e66f2e1f'
};
// 관리자 프로그램이 읽는 Firestore 데이터베이스 ID. 기본 DB를 쓰면 '(default)'
const FIRESTORE_DB_ID = '(default)';
const COLLECTION = 'consultations';
const SITE_ID = 'hanaro';          // 관리자 화면에서 사이트 구분용
const MAIL_API = '/api/send-inquiry-mail';
// 상품 문자열 맨 앞이 이 중 하나면 '통신사' 칸에 넣음 (예: 'KT / 500Mbps / 베이직')
const CARRIERS = ['KT', 'SK', 'SKB', 'SK브로드밴드', 'LG', 'LG U+', 'LG유플러스', 'KT스카이라이프', '스카이라이프', 'LG헬로비전', '헬로비전'];
// =================================

const FB_VER = '11.3.1';
let mods = null;
async function load() {
  if (mods) return mods;
  const [app, fs] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-firestore.js`)
  ]);
  const inst = app.getApps().length ? app.getApp() : app.initializeApp(FIREBASE_CONFIG);
  const db = FIRESTORE_DB_ID === '(default)' ? fs.getFirestore(inst) : fs.getFirestore(inst, FIRESTORE_DB_ID);
  mods = { fs, db };
  return mods;
}

export const digits = (v) => String(v || '').replace(/[^0-9]/g, '');
export const isPhone = (v) => /^01[016789][0-9]{7,8}$/.test(digits(v));
// 입력 중 자동 하이픈: 01012345678 → 010-1234-5678
export function fmtPhone(v) {
  const d = digits(v).slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return d.slice(0, 3) + '-' + d.slice(3);
  return d.slice(0, 3) + '-' + d.slice(3, d.length - 4) + '-' + d.slice(-4);
}

/**
 * 상담 접수
 * @param {object} p
 *   p.source  접수 경로 (예: '상담신청 팝업', '비밀지원금 문자받기', '셀프가입')
 *   p.name    이름 (선택)
 *   p.phone   휴대폰 (필수)
 *   p.memo    문의 내용 (선택)
 *   p.detail  고른 상품 (선택, 'KT / 500Mbps / 베이직 / 총액결합' 처럼 / 로 구분)
 *   p.consent 개인정보 동의 여부 (true 여야 접수)
 * @returns Firestore 문서 id, 또는 저장이 늦으면 'queued'
 */
export async function submitInquiry(p) {
  if (!isPhone(p.phone)) throw new Error('invalid phone');
  if (p.consent !== true) throw new Error('consent required');
  const phone = digits(p.phone);
  const qs = new URLSearchParams(location.search);
  const message = [p.memo, p.detail ? '선택 조건: ' + p.detail : ''].filter(Boolean).join('\n');

  const data = {
    name: String(p.name || '').slice(0, 50),
    phone,
    interest: String(p.detail || p.source || '상담신청').slice(0, 200),
    message: message.slice(0, 2000),
    source: p.source || '',
    pageUrl: location.href,
    referrer: document.referrer || '',
    utm_source: qs.get('utm_source') || '',
    status: 'pending',
    site: SITE_ID
  };

  // 관리 프로그램용 필드
  const detail = String(p.detail || '').trim();
  const head = detail.split('/')[0].trim();
  const office = {
    carrier: CARRIERS.indexOf(head) >= 0 ? head : (p.carrier || ''),
    serviceType: String(p.source || '상담신청'),
    serviceDetail: detail ? '[선택 상품]\n- ' + detail.split('/').map(s => s.trim()).filter(Boolean).join('\n- ') : '(선택 상품 없음)',
    memo: String(p.memo || '')
  };

  // (1) 메일 + 관리 프로그램 (화면을 기다리게 하지 않음, 페이지를 떠나도 전송되게 keepalive)
  try {
    fetch(MAIL_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({}, data, office, { consent: true })),
      keepalive: true
    }).catch(e => console.warn('mail api', e));
  } catch (e) { console.warn('mail api', e); }

  // (2) Firestore 저장 (최대 8초만 기다림, 이후엔 SDK가 알아서 재시도)
  const { fs, db } = await load();
  const write = fs.addDoc(fs.collection(db, COLLECTION), Object.assign({}, data, { createdAt: fs.serverTimestamp() }));
  write.catch(e => console.error('consultations write', e && e.code, e && e.message));
  return await Promise.race([
    write.then(ref => ref.id),
    new Promise(r => setTimeout(() => r('queued'), 8000))
  ]);
}
