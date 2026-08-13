import type { Config } from 'tailwindcss'

export default <Partial<Config>>{
  content: [],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: '#4f9cf9',
          foreground: '#0b1220',
        },
      },
      fontFamily: {
        mono: ['ui-monospace', '"SF Mono"', '"Cascadia Code"', '"JetBrains Mono"', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
}