# 하나로 (hnaro.co.kr)

빌드 과정이 없는 순수 정적 사이트입니다. (운영: 케이엘커넥트)

## Vercel 배포
1. 이 폴더 내용을 GitHub 저장소에 올립니다.
2. Vercel → Add New → Project → 저장소 선택.
3. Framework Preset: **Other**, Build Command / Output Directory 는 비워두고 Deploy.
4. Settings → Domains 에서 `hnaro.co.kr` 연결.

## 구조
- `index.html` / `index-Mobile.html` : 메인 (PC / 모바일), 나머지 페이지도 `X.html` / `X-Mobile.html`
- 화면 너비 767px 이하는 모바일, 넓으면 PC 페이지로 자동 이동
- PC 콘텐츠 최대 폭 1100px (각 PC 페이지의 `calc((100vw - 1100px) / 2)` 값을 바꾸면 조절)
- `dc-runtime.js` 화면 상태 처리 / `assets/` 이미지 / `favicon.*` 파비콘

## 아직 안 된 것
- 견적요청·인증글·제휴신청 폼은 입력값을 어디로도 전송하지 않습니다.
- `[대표번호]` 자리표시자, 개인정보처리방침의 보관기간 등 임시 문구는 확인 후 수정하세요.
