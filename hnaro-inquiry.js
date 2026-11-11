// 하나로(hnaro.co.kr) 상담 접수 - 브라우저용
//   1) Firestore 'consultations'에 저장 (클라이언트 SDK 직접)
//   2) /api/send-inquiry-mail 호출 → alnetreport@gmail.com 메일
// 사용: <script type="module"> import { submitInquiry, fmtPhone } from '/hnaro-inquiry.js'; </script>

// ===== 신규 Firebase 프로젝트 Web SDK 설정 (Firebase 콘솔 → 프로젝트 설정 → 내 앱) =====
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDzLPMQBSH1-Lx_TQth0p04ZiwruQepqZg',
  authDomain: 'hanaro-ffa2e.firebaseapp.com',
  projectId: 'hanaro-ffa2e',
  storageBucket: 'hanaro-ffa2e.firebasestorage.app',
  messagingSenderId: '836869189966',
  appId: '1:836869189966:web:8868ffc5c881d9e66f2e1f'
};
// ==========================================================================================

const SOURCE = 'hnaro';
const FB_VER = '11.3.1';
const CARRIERS = ['KT', 'LGU+', 'SK', '헬로비전', '스카이라이프'];

// 광고 클릭 ID는 첫 방문 페이지 주소에만 붙어 있으므로, 처음 들어올 때 저장해 둠
const TRACK_KEYS = ['utm_source', 'nclid', 'gclid'];
(function rememberTracking() {
  try {
    const qs = new URLSearchParams(location.search);
    TRACK_KEYS.forEach(k => { const v = qs.get(k); if (v) sessionStorage.setItem('hn_' + k, v.slice(0, 200)); });
  } catch (e) {}
})();
function tracking(k) {
  try { return new URLSearchParams(location.search).get(k) || sessionStorage.getItem('hn_' + k) || ''; } catch (e) { return ''; }
}

let mods = null;
async function load() {
  if (mods) return mods;
  const [app, fs] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-firestore.js`)
  ]);
  const inst = app.getApps().length ? app.getApp() : app.initializeApp(FIREBASE_CONFIG);
  mods = { fs, db: fs.getFirestore(inst) };
  return mods;
}

export const digits = (v) => String(v || '').replace(/[^0-9]/g, '');
export const isPhone = (v) => /^01[016789][0-9]{7,8}$/.test(digits(v));
export function fmtPhone(v) {
  const d = digits(v).slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return d.slice(0, 3) + '-' + d.slice(3);
  return d.slice(0, 3) + '-' + d.slice(3, d.length - 4) + '-' + d.slice(-4);
}

/**
 * @param {object} p
 *  name, phone(필수), carrier('KT'|'LGU+'|'SK'|'헬로비전'|'스카이라이프'),
 *  productCondition('인터넷+TV'|'인터넷단독'), internetSpeed, tvProduct, bundleDiscount,
 *  estimatedMonthly, message, website(허니팟: 폼의 숨김 칸 값 그대로), consent(true 필수)
 */
export async function submitInquiry(p) {
  if (!isPhone(p.phone)) throw new Error('invalid phone');
  if (p.consent !== true) throw new Error('consent required');
  if (String(p.website || '').trim()) return 'ignored';          // 봇이면 아무것도 저장하지 않음

  const s = (v, n = 200) => String(v == null ? '' : v).slice(0, n);
  const data = {
    name: s(p.name, 50),
    phone: digits(p.phone),
    carrier: CARRIERS.indexOf(p.carrier) >= 0 ? p.carrier : s(p.carrier, 20),
    productCondition: s(p.productCondition, 20),
    internetSpeed: s(p.internetSpeed, 50),
    tvProduct: s(p.tvProduct, 100),
    bundleDiscount: s(p.bundleDiscount, 100),
    estimatedMonthly: s(p.estimatedMonthly, 30),
    message: s(p.message, 2000),
    source: SOURCE,
    pageUrl: s(location.href, 500),
    referrer: s(document.referrer, 500),
    utm_source: tracking('utm_source'),
    nclid: tracking('nclid'),
    gclid: tracking('gclid')
  };

  // 2) 메일 (화면을 붙잡지 않음, 페이지를 떠나도 전송)
  try {
    fetch('/api/send-inquiry-mail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({}, data, { website: '' })),
      keepalive: true
    }).catch(e => console.warn('mail api', e));
  } catch (e) { console.warn('mail api', e); }

  // 1) Firestore 저장 (최대 8초 대기, 이후 SDK가 재시도)
  const { fs, db } = await load();
  const write = fs.addDoc(fs.collection(db, 'consultations'), Object.assign({}, data, { createdAt: fs.serverTimestamp() }));
  write.catch(e => console.error('consultations write', e && e.code, e && e.message));
  return await Promise.race([
    write.then(ref => ref.id),
    new Promise(r => setTimeout(() => r('queued'), 8000))
  ]);
}
