# 🐱 고양이 돌리기 — 네이티브 (React Native / Expo)

웹 버전(`../client`, `../server`)을 **React Native(Expo)** 로 재작성한 네이티브 앱입니다.
기존 **Three.js 3D 코드와 GLB 고양이 에셋을 그대로 재사용**하고, iOS·Android 양쪽으로
빌드해 앱스토어/플레이스토어에 올릴 수 있는 형태예요.

> 이 폴더는 1차 마일스톤입니다 — **핵심 게임 루프(회전 물리·점수·떼쓰기·고양이 선택·랭킹)**
> 가 포팅돼 있어요. 상용화에 필요한 결제·계정·푸시 등은 이 위에 얹어가면 됩니다
> (아래 "다음 단계" 참고).

## 빠른 시작

```bash
cd native
npm install          # 또는: npx expo install (버전 자동 정합)
npx expo start       # QR 코드 → Expo Go 앱으로 실기기 실행
```

- **시뮬레이터**: `npx expo start` 후 `i`(iOS) / `a`(Android).
- 3D(expo-gl)는 **Expo Go에서도 동작**하지만, 상점 배포용 빌드는 아래 EAS를 씁니다.

> 처음 `npm install`은 정확한 버전 정합을 위해 `npx expo install`로 한 번 더 맞추는 걸
> 권장해요. `package.json`의 버전은 Expo SDK 52 기준입니다.

## 구조

```
native/
  App.js                  화면 조립: HUD·돌리기 버튼·고양이 칩·랭킹 모달
  index.js                진입점 (expo-three 전역 패치 포함)
  app.json                Expo 설정 (번들 ID, 아이콘 등)
  metro.config.js         .glb 를 에셋으로 인식시키는 설정
  src/
    cats.js               고양이 카탈로그 + 닉네임 정규식 (웹과 공유 규칙)
    theme.js              색상 팔레트 (웹 style.css 기준)
    config.js             랭킹 백엔드 주소 (비우면 로컬 모드)
    game/
      engine.js           회전 물리·점수·떼쓰기 (웹 main.js 1:1 포팅, 순수 함수)
      loadCat.js          GLB 로더 (base64 → ArrayBuffer → GLTFLoader.parse)
      CatStage.js         react-three-fiber 3D 씬 + useFrame 게임 루프
    ranking/
      ranking.js          온라인(서버) / 로컬(AsyncStorage) 랭킹
    ui/
      RankingModal.js     랭킹 모달 (등록·목록)
  assets/cats/*.glb       고양이 모델 (웹에서 복사)
```

## 랭킹 백엔드 연결

기본은 **로컬 모드**(이 기기 AsyncStorage에만 저장)라 서버 없이 바로 돌아갑니다.
공용 온라인 랭킹을 쓰려면:

1. 웹 프로젝트의 `../server`를 호스트(Render, Railway, Fly.io, VPS…)에 배포.
2. `src/config.js`의 `API_BASE`에 그 공개 URL을 입력.
3. 서버 CORS 허용 오리진에 앱 요청을 추가.

서버의 치팅 방지(HMAC 세션 토큰·점수 타당성·1회용 세션)는 그대로 사용됩니다.

## 상점 빌드 (EAS)

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build -p android        # .aab  (Play Console 업로드)
eas build -p ios            # .ipa  (App Store Connect, 애플 개발자 계정 필요)
```

- 애플 개발자 계정(연 $99), 구글 플레이 개발자 계정(1회 $25)이 필요해요.
- iOS 빌드는 EAS 클라우드 빌드를 쓰면 Mac 없이도 가능합니다.

## 다음 단계 (상용화 로드맵)

- [ ] 앱 아이콘 / 스플래시 (`app.json`의 `icon`, `splash` 지정)
- [ ] 진짜 고양이 아트로 GLB 교체 (현재는 저폴리 자리표시자)
- [ ] 사운드/햅틱(`expo-haptics`)으로 손맛 강화
- [ ] 계정·클라우드 세이브(예: Supabase) — 기기 교체 시 기록 유지
- [ ] 인앱결제(`react-native-iap`) — 고양이 스킨/꾸미기
- [ ] 광고(`react-native-google-mobile-ads`) 또는 구독
- [ ] 푸시 알림(`expo-notifications`) — "고양이가 떼쓰고 있어요" 리텐션
- [ ] 분석(예: Firebase/Amplitude), 크래시 리포팅(Sentry)

## 알아두기 (제약/주의)

- 이 1차 포팅은 **실기기 빌드 검증 전**입니다. 첫 `expo start`에서 패키지 버전
  정합(`npx expo install`)이나 expo-gl/three 조합에서 소소한 조정이 필요할 수 있어요.
- 웹의 importmap 대신 **번들된 three**를 씁니다. GLB는 외부 텍스처가 없는 저폴리라
  `GLTFLoader.parse`로 메모리에서 바로 로드합니다.
