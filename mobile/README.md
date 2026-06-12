# 🐱 고양이 돌리기 — 모바일 (React Native / Expo)

웹 버전([../client](../client))을 React Native(Expo)로 재작성한 앱입니다. 앱스토어 ·
플레이스토어 제출을 목표로 합니다. 3D는 **expo-gl + Three.js**, 랭킹은 웹과 **같은
Firestore**(같은 프로젝트·같은 보안 규칙)를 사용합니다.

## 구성

```
mobile/
  App.js               화면 UI(HUD·돌리기 버튼·고양이 선택·랭킹 모달) + 상태
  src/
    CatScene.js        expo-gl GLView에 Three.js 씬 구성 (Y축 모멘텀 회전·점수·떼쓰기)
    cats.js            고양이 카탈로그 + GLB require 매핑
    firebase.js        Firestore 랭킹 (제출/조회), RN용 long-polling 설정
    firebaseConfig.js  Firebase 설정(웹과 동일 프로젝트)
  assets/cats/*.glb    고양이 모델(웹과 동일 파일)
  app.json             Expo 앱 설정(이름·번들 ID 등)
  metro.config.js      .glb를 에셋으로 인식
```

## 실행 (개발)

사전 준비: Node 18+, 스마트폰에 **Expo Go** 앱 설치(App Store/Play Store에서 무료).

```bash
cd mobile
npm install
# (권장) Expo가 SDK에 맞는 버전으로 네이티브 의존성 정렬:
npx expo install three @react-three/fiber expo-gl expo-three expo-asset expo-file-system firebase

npx expo start
```

터미널/브라우저에 뜬 **QR 코드를 Expo Go로 스캔**하면 실기기에서 바로 실행돼요.
이 앱이 쓰는 네이티브 모듈(expo-gl, expo-asset, expo-file-system)은 모두 Expo Go에
포함돼 있어 **별도 네이티브 빌드 없이 테스트**할 수 있습니다.

> 시뮬레이터로 보려면 `npx expo start --ios`(macOS+Xcode) 또는 `--android`(Android Studio).

## 스토어 제출 (EAS Build)

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform ios       # 또는 android, all
eas submit --platform ios       # 빌드 후 스토어 업로드
```

제출 전 준비물:
- **앱 아이콘/스플래시 이미지**: `app.json`의 `icon`/`splash`에 1024×1024 PNG 등을 지정
  (지금은 Expo 기본값 사용 중 — 제출 전 브랜딩 이미지 교체 권장)
- **Apple Developer** 계정($99/년), **Google Play** 계정($25 1회)
- **개인정보처리방침 URL**: 닉네임+점수를 Firestore에 저장하므로 수집 항목 고지 필요
- 번들 ID는 `com.catspine.app`로 설정돼 있음(원하면 변경)

## 보안 / 백엔드

- 랭킹은 웹과 **동일한 Firestore 컬렉션 `scores`** 를 공유 → 웹·앱 랭킹이 합쳐집니다.
- 점수 검증(닉네임 길이·점수 범위·고양이 종류·서버 시각)은 **Firestore 보안 규칙**
  ([../firestore.rules](../firestore.rules))이 그대로 강제해요.
- 네이티브에서는 봇 차단을 **App Check(App Attest/Play Integrity)** 로 더 강하게 걸 수
  있습니다(웹 reCAPTCHA보다 견고). 적용 시 `src/firebase.js`에 App Check 초기화를 추가.

## 재사용한 것 / 새로 만든 것

- **그대로**: 게임 물리(회전 가속·마찰·한 바퀴=1점), 떼쓰기 로직, GLB 모델, Firestore 규칙
- **포팅**: Three.js 씬(웹 WebGL → expo-gl), Firestore 호출(웹 SDK → RN long-polling)
- **새로 작성**: UI(HTML/CSS → RN 컴포넌트/StyleSheet), 접근성 속성

## 참고 (검증 상태)

이 모바일 코드는 시뮬레이터/실기기 실행이 필요한 부분(expo-gl GL 컨텍스트, GLB 로딩)이라
개발 PC 환경에서는 자동 검증을 못 했어요. `npx expo start`로 실기기에서 한 번 띄워보고,
이상이 있으면 알려주시면 바로 잡겠습니다. 가장 가능성 있는 이슈는 (1) 의존성 버전 정렬
(`npx expo install`로 해결), (2) `GLTFLoader` 임포트 경로 정도입니다.
