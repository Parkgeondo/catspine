# 🐱 고양이 돌리기 — 토스 미니앱 (앱인토스)

웹 버전(`../client`)을 **앱인토스 WebView 미니앱** 구조로 이식한 빌드입니다.
게임 코드는 `client/`와 동일하고, three.js를 CDN(importmap) 대신 **npm + Vite 번들**로
바꿨어요 (검수·오프라인에 유리).

## 시작하기

```bash
cd miniapp
npm install
npx ait init        # 앱인토스 CLI 초기화 (최초 1회, 콘솔 로그인)
npm run dev         # 로컬 개발 서버 (localhost:5173)
```

## ⚠️ 먼저 할 일: appName 맞추기

[granite.config.ts](granite.config.ts)의 `appName: 'catspine'`을 **앱인토스 콘솔에
등록한 실제 appName**으로 바꿔주세요. 딥링크(`intoss://{appName}`)와 앱 식별에 쓰입니다.
`brand.icon`도 콘솔에 업로드한 아이콘 URL로 채워야 해요.

## 샌드박스 테스트

1. 콘솔 안내에 따라 **샌드박스 앱**(테스트용 토스앱)을 폰에 설치.
2. `npm run dev` 실행 (실기기 테스트는 `granite.config.ts`의 `web.host`를 컴퓨터
   IP로 바꾸고 `vite dev --host`).
3. 샌드박스 앱에서 `intoss://{appName}` 딥링크로 접속.

## 출시

```bash
npm run build       # dist/ 생성
```

1. 콘솔에 번들 업로드 → 토스앱에서 최종 테스트.
2. 테스트 완료 후 콘솔에서 **검수(출시) 요청**.
3. 승인되면 토스 앱에 노출 🎉

## 랭킹 서버 (공용 온라인 랭킹)

기본은 로컬(localStorage) 랭킹입니다. 공용 랭킹 켜는 법:

1. **서버 배포**: 저장소 루트의 `render.yaml`로 Render에 원클릭 배포
   (Render 대시보드 → New → **Blueprint** → 이 저장소·브랜치 선택).
   `SCORE_SECRET`은 자동 생성되고, `NODE_ENV`/`TRUST_PROXY`도 설정돼 있어요.
2. **주소 연결**: 배포된 URL(예: `https://catspine-server.onrender.com`)을
   `index.html`의 `window.CAT_API_BASE`에 입력.
3. **CORS 허용**: 샌드박스에서 랭킹을 열어보면 서버 로그에
   `[cors] blocked origin: https://...` 로 토스 웹뷰의 실제 오리진이 찍혀요.
   그 값을 Render 환경변수 `ALLOWED_ORIGINS`에 추가(쉼표 구분)하면 끝.

> Render 무료 플랜은 디스크가 휘발성이라 재배포 시 `leaderboard.json`이
> 초기화돼요. 본격 운영 전에 유료 디스크나 외부 DB로 옮기는 걸 권장.

## 구조

```
miniapp/
  granite.config.ts    앱인토스 미니앱 설정 (appName·브랜드·빌드 명령)
  vite.config.js       상대 경로 base 등 Vite 설정
  index.html           client/index.html에서 importmap만 제거한 버전
  src/                 client/의 main.js·ranking.js·cats.js·style.css 그대로
  public/assets/cats/  GLB 모델
```

> `src/` 게임 코드는 `client/`와 동기화 대상입니다. 웹 버전을 고치면 여기도 복사해
> 주세요 (장기적으로는 공용 패키지로 빼는 게 좋아요).
