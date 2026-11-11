# 하나로 (hnaro.co.kr) 업로드 파일

이 폴더 "안의 파일 전부"를 깃허브 저장소 맨 위에 넣으세요. (폴더째 넣지 말 것)

꼭 있어야 하는 파일 (하나라도 없으면 화면이 깨지거나 접수가 안 됨)
- support.js          : 화면을 그려주는 프로그램
- hnaro-forms.js      : 상담 폼 연결
- hnaro-inquiry.js    : Firebase 저장 + 메일 호출
- api/send-inquiry-mail.ts : 메일 발송
- package.json, vercel.json
- *.html 28개 (index.html, index-m.html, compare.html ...)

firestore.rules / firebase.json 은 사이트용이 아니라 Firebase 콘솔 규칙 탭에 붙여넣는 용도
