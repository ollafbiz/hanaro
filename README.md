# 하나로 (hnaro.co.kr)

빌드 과정이 없는 순수 정적 사이트입니다. (운영: 케이엘커넥트)

## Vercel 배포
1. 이 폴더를 GitHub 저장소에 올립니다.
2. Vercel → Add New → Project → 저장소 선택.
3. Framework Preset: **Other**, Build Command / Output Directory: 비워두기 → Deploy.
4. Settings → Domains 에서 `hnaro.co.kr` 연결.

## 구조
- `index.html` / `index-Mobile.html` : 메인 (PC / 모바일)
- `Compare`, `Internet`, `Beauty`, `Moving`, `Cleaning`, `Plumbing`, `Rent`, `Category`(웨딩), `Interior`, `Accounting`, `Partner`, `Review`, `Privacy` 각각 `X.html` / `X-Mobile.html`
- 화면 너비 767px 이하이면 모바일 페이지로, 넓으면 PC 페이지로 자동 이동합니다.
- `dc-runtime.js` : 화면 상태(탭, 배너, 폼 입력 등)를 처리하는 작은 스크립트
- `assets/` : 이미지

## 아직 안 된 것
- 견적요청 / 인증글 / 제휴신청 폼은 입력값을 어디로도 전송·저장하지 않습니다. (메일·내부 프로그램 연동 필요)
- `[대표번호]`, `[사이트A]` 같은 자리표시자가 일부 남아 있습니다.
- 개인정보처리방침의 보관기간 등은 임시 문구이니 확인 후 수정하세요.
