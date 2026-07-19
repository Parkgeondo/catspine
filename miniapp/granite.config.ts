import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  // ⚠️ 반드시 앱인토스 콘솔에 등록한 appName과 정확히 일치해야 합니다.
  // 딥링크(intoss://{appName})와 앱 식별에 쓰여요. 콘솔 값으로 바꿔주세요.
  appName: 'catspine',
  brand: {
    displayName: '고양이 돌리기',
    primaryColor: '#7c5cff',
    icon: '', // 콘솔에 업로드한 아이콘 이미지 URL
  },
  web: {
    host: 'localhost',
    port: 5173,
    commands: {
      dev: 'vite dev',
      build: 'vite build',
    },
  },
  permissions: [],
  outdir: 'dist',
});
