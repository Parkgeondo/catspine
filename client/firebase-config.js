// Firebase 웹 앱 설정.
// ⚠️ 이 apiKey는 "비밀키"가 아니라 프로젝트를 가리키는 공개 식별자예요.
//    웹 클라이언트에 노출되는 게 정상이며, 실제 보안은 Firestore 보안 규칙
//    (firestore.rules) + App Check로 겁니다. 그래서 커밋해도 안전합니다.
export const firebaseConfig = {
  apiKey: 'AIzaSyDbSlvuY1wMrZwGZVanfLr0T2NEwQJa6FI',
  authDomain: 'catspine-4e7ae.firebaseapp.com',
  projectId: 'catspine-4e7ae',
  storageBucket: 'catspine-4e7ae.firebasestorage.app',
  messagingSenderId: '965566934734',
  appId: '1:965566934734:web:838d5edaf7d44d169aaa9f',
  measurementId: 'G-B5TE3YRC0B',
};
