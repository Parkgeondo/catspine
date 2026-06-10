# 🐱 고양이 돌리기 (Cat Spin)

누워 있는 3D 고양이를 한 번 터치(또는 Space/Enter)하면 한 바퀴 데구르르 굴러요.
한 바퀴 돌 때마다 **+1점**. 한동안 안 돌리면 고양이가 **떼를 씁니다** 😾.
점수는 서버 랭킹에 올릴 수 있고, **닉네임은 랭킹 등록 시에만** 사용해요.

## 빠른 시작

```bash
npm install
npm start
# http://localhost:3000 접속
```

`npm install` 후 바로 실행됩니다. 고양이 GLB는 이미 `client/assets/cats/`에 생성되어 있어요.
모델을 다시 만들려면: `npm run make-cats`

## 구성

```
client/                브라우저 게임 (빌드 불필요, Three.js는 importmap으로 로드)
  index.html           UI 뼈대 + 접근성 마크업
  main.js              3D 씬 · 회전/점수 · 떼쓰기 로직
  ranking.js           세션/점수 서버 연동, 랭킹 표시
  cats.js              고양이 카탈로그(공유)
  assets/cats/*.glb    생성된 저폴리 고양이 모델
server/
  server.js            Express 서버(정적 제공 + API)
  security.js          세션 토큰·검증·치팅 방지
  ranking-store.js     JSON 파일 기반 랭킹 저장(원자적 쓰기)
tools/make-cats.js     의존성 없이 유효한 .glb를 만드는 생성기
data/leaderboard.json  랭킹 데이터(자동 생성, git 제외)
```

## 게임 방법 / 접근성

- **돌리기**: 큰 `돌리기` 버튼, 화면(고양이) 터치/클릭, 또는 **Space / Enter**.
- **고양이 선택**: 하단 칩(치즈/턱시도/회색/삼색). 선택은 기기에 저장돼요.
- 로그인·닉네임 없이 바로 플레이 가능 — **닉네임은 랭킹 등록할 때만** 입력.
- 스크린리더용 `aria-live`로 점수와 고양이 기분을 읽어줘요.
- `prefers-reduced-motion`을 켜면 흔들림/떼쓰기 모션을 줄이고 회전을 짧게 처리해요.

## 보안 설계 (요약)

점수 계산은 클라이언트에서 일어나므로 **점수 자체는 신뢰하지 않는다**는 전제로 설계했어요.

| 위협 | 대응 |
| --- | --- |
| 점수 조작(말도 안 되는 점수) | 서버가 세션 시작 시각을 발급 → 제출 점수를 **경과 시간 대비 물리적으로 가능한 최대치**와 비교(`isPlausibleScore`). |
| 세션/점수 위조 | 세션 토큰은 **HMAC-SHA256 서명**. 비교는 `timingSafeEqual`(타이밍 공격 방지). |
| 같은 점수 반복 등록(리플레이) | 세션은 **1회용** — 등록되면 소비됨. |
| XSS(닉네임에 스크립트 삽입) | 출력은 전부 `textContent`로 렌더(HTML 해석 안 함) + 서버에서 닉네임 정규식 검증. |
| 닉네임 악용 | 길이 2~12자, 유니코드 글자/숫자/일부 기호만 허용. `NFC` 정규화 + 공백 정리. |
| 무차별 호출 | `express-rate-limit`로 IP당 분당 한도(쓰기 20, 일반 120). |
| 비밀키 노출 | `SCORE_SECRET`는 **환경변수**에서만. 프로덕션에서 미설정 시 **서버 시작 거부**. 하드코딩 키 없음. |
| 인젝션/응답 변조 | 저장은 매개변수화된 객체 연산(문자열 SQL 없음). `helmet`으로 보안 헤더 + **CSP(nonce 기반)** 적용. |
| 페이로드 폭주 | `express.json({ limit: '1kb' })`. |

> 클라이언트 점수는 본질적으로 위조 가능합니다. 위 대응은 *현실적인* 치팅(거대 점수·리플레이·위조)을
> 막는 수준이며, 상금이 걸린 대회 등 강한 보장이 필요하면 서버 권위 게임 로직(탭마다 서명된 증명 등)으로
> 확장해야 합니다. 확장 지점은 `server/security.js`에 주석으로 표시해 두었어요.

## 프로덕션 배포 시

```bash
# 1) 강력한 비밀키 생성
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 2) 환경변수 설정 후 실행
#    SCORE_SECRET=<위 값>  NODE_ENV=production  (프록시 뒤면 TRUST_PROXY=1)
NODE_ENV=production SCORE_SECRET=... npm start
```

`.env.example` 참고. HTTPS 종단(리버스 프록시)을 두는 것을 권장합니다.

## GitHub Pages 배포

이 저장소에는 `client/` 폴더를 GitHub Pages로 자동 배포하는 워크플로
([.github/workflows/deploy.yml](.github/workflows/deploy.yml))가 들어 있어요.

1. GitHub 저장소 → **Settings → Pages → Build and deployment → Source** 를
   **GitHub Actions** 로 설정 (최초 1회).
2. `main` 에 푸시하면 자동 배포됩니다. 주소: `https://parkgeondo.github.io/catspine/`

> **중요:** GitHub Pages는 정적 파일만 호스팅하므로 **Node 랭킹 서버는 동작하지 않아요.**
> 백엔드에 연결되지 않으면 게임은 정상 작동하되, 랭킹은 자동으로 **이 기기 로컬 기록
> (localStorage)** 으로 전환됩니다(다이얼로그에 안내 문구 표시).
>
> 온라인 공용 랭킹까지 쓰려면 `server/`를 별도 호스트(Render, Railway, Fly.io, VPS 등)에
> 배포하고, `client/index.html`의 `<head>`에 백엔드 주소를 지정하세요:
>
> ```html
> <script>window.CAT_API_BASE = 'https://your-backend.example.com';</script>
> ```
>
> 이때 서버의 CORS 허용 오리진에 Pages 도메인을 추가해야 합니다.

## Firebase 온라인 랭킹 (서버 없이 무료)

GitHub Pages 같은 정적 호스팅에서 **공용 랭킹**을 쓰려면 Firebase Firestore를
이용해요. 클라이언트가 Firestore에 직접 읽고 쓰므로 **별도 서버가 필요 없습니다.**
([client/firebase.js](client/firebase.js), [client/firebase-config.js](client/firebase-config.js))

랭킹 백엔드는 **자동 선택**돼요: `Firestore(준비됨) → Node 서버 → 로컬(localStorage)`.
Firestore가 아직 준비되지 않으면 자동으로 로컬 기록을 쓰다가, 설정을 마치면 다음 접속부터
자동으로 공용 랭킹으로 올라갑니다.

### 설정 (한 번만, Firebase 콘솔)

1. **Firestore Database 생성**: 콘솔 → Build → Firestore Database → *데이터베이스 만들기* →
   위치 선택 → *프로덕션 모드*로 시작.
2. **보안 규칙 게시**: Firestore → Rules 탭에 [firestore.rules](firestore.rules) 내용을
   붙여넣고 *게시(Publish)*. (닉네임·점수 범위·고양이 종류를 서버단에서 강제해요.)
3. 끝! `client/firebase-config.js`에는 이미 이 프로젝트 설정이 들어 있어요.

> 웹 `apiKey`는 비밀이 아니라 공개 식별자라서 커밋해도 안전합니다. 실제 보안은
> Firestore 규칙으로 겁니다.

### 더 단단히 (선택) — App Check

봇·외부 스크립트의 직접 쓰기를 막으려면 **App Check(reCAPTCHA v3)** 를 권장해요.
콘솔 → App Check에서 reCAPTCHA를 등록하고, 사이트 키로 `client/firebase.js`의 `initFirebase`
에 App Check 초기화를 추가하면 됩니다(무료).

> ⚠️ 서버가 없으므로 **시간 기반 정밀 안티치트**(경과 시간 대비 점수 검증)는 적용되지
> 않아요. 그 수준이 필요하면 Cloud Functions(Blaze 요금제)로 검증 로직을 옮기거나,
> 기존 `server/`를 별도 호스트에 띄우고 `window.CAT_API_BASE`로 연결하세요.

## 진짜 고양이 모델로 교체하기

`tools/make-cats.js`가 만든 GLB는 “임의의” 저폴리 자리표시자예요.
실제 아트로 바꾸려면 같은 파일명으로 `client/assets/cats/<id>.glb`를 덮어쓰면 됩니다
(`cheese`, `tuxedo`, `gray`, `calico`). 새 고양이를 추가하려면 `client/cats.js`와
`server/security.js`의 `VALID_CAT_IDS`에 같은 `id`를 등록하세요.

> 고양이는 **옆으로 90° 누운** 자세로 만들어지고(`tools/make-cats.js`의 `layOnSide`),
> 게임은 **세로(Y축)** 를 기준으로 턴테이블처럼 돌립니다. 코드가 모델을 Y축에 맞춰
> 중앙 정렬하고 쿠션 위에 올려놓으므로, 다른 GLB를 넣어도 그 자리에서 돌아가요.
