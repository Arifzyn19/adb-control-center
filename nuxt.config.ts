export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  modules: ['@nuxtjs/tailwindcss'],

  typescript: {
    strict: true,
    typeCheck: false,
  },

  css: ['@xterm/xterm/css/xterm.css', '~/assets/css/main.css'],

  app: {
    head: {
      title: 'ADB Control Center',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Wireless Android device management and ADB control platform' },
        { name: 'color-scheme', content: 'dark' },
      ],
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    },
  },

  runtimeConfig: {
    adbPath: process.env.ADB_PATH || 'adb',
    adbServerPort: Number(process.env.ADB_SERVER_PORT || 5037),
    pairingPassword: process.env.ADB_PAIRING_PASSWORD || 'adb-control-center',
    maxDevices: Number(process.env.MAX_DEVICES || 8),
    logcatMaxBuffer: Number(process.env.LOGCAT_MAX_BUFFER || 2000),
    auth: {
      token: process.env.ADB_CONTROL_TOKEN || 'change-me',
      sessionTtl: Number(process.env.SESSION_TTL || 86400),
    },
  },

  nitro: {
    scheduledTasks: {
      // placeholder — real tasks are declared via defineTask if needed
    },
  },

  routeRules: {
    '/': { prerender: false },
  },

  build: {
    transpile: ['lucide-vue-next'],
  },
})