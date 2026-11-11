# 하나로 (hnaro.co.kr)

정적 사이트 + 상담 접수용 서버 함수 1개(`api/send-inquiry-mail.js`). 빌드 과정 없음. (운영: 케이엘커넥트)

## Vercel 배포
1. 이 폴더 내용을 GitHub 저장소에 올립니다.
2. Vercel → Add New → Project → 저장소 선택 → Framework Preset **Other** → Deploy.
3. Settings → Domains 에서 `hnaro.co.kr` 연결.

## 상담 접수 연동
접수 1건이 ① 관리자 메일 ② 사무실 관리 프로그램 ③ Firebase(`hanaro-ffa2e`) 저장 으로 동시에 들어갑니다.
- Firebase 설정은 `inquiry.js` 에 들어 있음 (DB ID `(default)`, 사이트 코드 `hanaro`).
- Firestore 규칙: `consultations` 는 쓰기만 공개, 읽기 불가.
- 올라프 프로그램은 Firebase 동기화(`firebase-projects.json` 의 hanaro 항목 + 서비스계정 키)로 접수를 가져옵니다. `OFFICE_API_*` 는 비워두세요(중복 방지).
- Vercel 환경변수 입력 필요 (목록은 `.env.example`). 키·비밀번호는 코드에 쓰지 말 것.
- 연결된 폼: 인터넷 상담(Internet), 견적신청(Compare), 계약 인증(Review) 의 PC/모바일.
- 계약 인증의 사진 첨부는 아직 전송·저장되지 않습니다.

## 구조
- `X.html` / `X-Mobile.html` : 767px 이하는 모바일, 넓으면 PC. PC 콘텐츠 최대 폭 1100px
- `dc-runtime.js` 화면 처리 / `inquiry.js` 접수 / `api/` 서버 함수 / `assets/` 이미지 / `favicon.ico`
