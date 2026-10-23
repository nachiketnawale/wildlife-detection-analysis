/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        forest: {
          50: '#f1f8f4',
          100: '#def0e6',
          200: '#bfe2d0',
          300: '#92cbb1',
          400: '#5eac8b',
          500: '#388e6b',
          600: '#24734b', // user requested
          700: '#1d5c3d',
          800: '#183d2c', // user requested
          900: '#153627',
          950: '#0a1d15',
        },
      },
    },
  },
  plugins: [],
}
