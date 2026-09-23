import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Tema "NSA Café" (23/09/2026), cores tiradas do logo: grafite
        // (#3C4B52) como cor principal, cobre de café torrado de destaque.
        primary: '#3C4B52',
        secondary: '#A8683C',
        accent: '#95d5b2',
        light: '#d8f3dc',
        grafite: '#2F3B41',
        'grafite-claro': '#3E4D54',
        cobre: '#C98B52',
        creme: '#F4F1EC',
      },
      fontFamily: {
        sans: ['system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
