import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

// 종이색. index.html 의 theme-color(라이트), tokens.css 의 --paper 와 같은 값이다.
const PAPER = '#f2f2f7'
const MAX_PRECACHE_BYTES = 5 * 1024 * 1024

// 프로덕션 CSP. 스크립트는 같은 출처 파일만 실행하고, 외부로 나가는 연결·프레임·플러그인은 전부 막는다.
// style-src 'unsafe-inline' 은 React 의 style 속성(색·위치 계산)이 쓰므로 남긴다.
// <meta> CSP 는 frame-ancestors 를 지원하지 않는다. 배포 호스트에서 응답 헤더로 따로 걸어야 한다.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-src 'none'",
].join('; ')

// 개발 서버(Vite HMR)는 인라인 스크립트를 주입하므로 빌드 결과물에만 CSP 를 넣는다.
function contentSecurityPolicy(): Plugin {
  return {
    name: 'gosay:content-security-policy',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: CONTENT_SECURITY_POLICY },
        injectTo: 'head-prepend',
      },
    ],
  }
}

export default defineConfig({
  // 상대 경로로 빌드한다. GitHub Pages처럼 하위 경로(/godo/)에 올려도, 루트에 올려도 같은 빌드가 동작한다.
  base: './',
  plugins: [
    react(),
    contentSecurityPolicy(),
    VitePWA({
      registerType: 'autoUpdate',
      // 개발 서버에서는 서비스 워커를 켜지 않는다(HMR·캐시와 충돌).
      devOptions: { enabled: false },
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'gosay',
        short_name: 'gosay',
        description: '입에서 나오게 만드는 영어 산출 훈련',
        lang: 'ko',
        dir: 'ltr',
        display: 'standalone',
        orientation: 'any',
        categories: ['education'],
        theme_color: PAPER,
        background_color: PAPER,
        start_url: './',
        scope: './',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // 앱 셸(html·js·css)과 아이콘, 그리고 **기준 음원(m4a)** 을 설치 때 내려받는다.
        // 지하철에서 쓰는 앱이라 음원이 캐시에 없으면 핵심 흐름이 그 자리에서 죽는다.
        //
        // 글꼴은 일부러 뺀다. Pretendard 동적 서브셋은 woff2 가 100개가 넘어 전부 미리 받으면
        // precache 가 4.2MB / 150항목이 되고, 설치가 끝나기 전에 오프라인이 되면 아무것도 안 열린다.
        // 아래 runtimeCaching 으로 실제로 쓴 서브셋만 쥐고, 없는 글자는 시스템 글꼴로 떨어진다.
        globPatterns: ['**/*.{html,js,css,svg,png,ico,webmanifest,m4a,json}'],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'font',
            handler: 'CacheFirst',
            options: {
              cacheName: 'gosay-fonts',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        maximumFileSizeToCacheInBytes: MAX_PRECACHE_BYTES,
        // HashRouter 라서 주소는 늘 '/#/...' 이다. 탐색 요청은 전부 앱 셸로 돌린다.
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/dev/**', 'src/main.tsx', 'src/**/*.d.ts'],
      thresholds: { lines: 80, functions: 80, statements: 80, branches: 70 },
    },
  },
})
