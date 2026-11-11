# 하나로 (hnaro.co.kr)

- 페이지: PC `/파일명`, 모바일 `/파일명-m` (화면 폭 768px 이하면 모바일로 자동 이동, 주소의 utm·nclid·gclid 유지)
- 상담 접수: `hnaro-forms.js`가 모든 상담·견적·계약인증 폼을 처리 → Firestore `consultations` 저장 + `/api/send-inquiry-mail` 메일 발송
- Firebase 설정: `hnaro-inquiry.js` 맨 위
- 메일 함수: `api/send-inquiry-mail.ts` (Vercel 환경변수 GMAIL_USER, GMAIL_APP_PASSWORD, NOTIFY_TO)
- `firestore.rules`: Firebase 콘솔 → Firestore → 규칙 탭에 붙여넣고 게시 (사이트 배포와 별개)
