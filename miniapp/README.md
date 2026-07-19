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

## 랭킹 (기본: Firebase Firestore)

랭킹은 3단 폴백으로 동작해요: **Firestore → Node 서버 → 이 기기 로컬(localStorage)**.

기본값은 **Firestore 공용 랭킹**입니다 — `src/firebase-config.js`가 Firebase 프로젝트
`catspine-4e7ae`를 가리키고 있어서, 서버 호스팅 없이 바로 전체 사용자 공용 랭킹이
동작해요 (항상 켜져 있고, 데이터 영구 보존, CORS 설정 불필요).

- 점수 검증은 `../firestore.rules`(Firestore 보안 규칙)가 담당 — 형식·범위 검증
  수준의 "캐주얼 게임" 등급이에요. 더 강한 치팅 방지가 필요해지면 App Check 또는
  Cloud Functions(Blaze 요금제)로 확장.
- SDK는 npm으로 번들해서 런타임 CDN 의존이 없어요 (웹 버전 `client/`는 CDN 임포트).

Node 서버 방식으로 바꾸고 싶으면: Firestore 설정을 비우고, 루트의 `render.yaml`로
서버를 배포한 뒤 `index.html`의 `window.CAT_API_BASE`에 주소를 넣으세요
(CORS는 서버 로그의 `[cors] blocked origin` 값을 `ALLOWED_ORIGINS`에 추가).

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
