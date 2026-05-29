/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        astraea: {
          pink: '#F9A8C9',
          white: '#FFFFFF',
          blush: '#FDDDE6',
          cream: '#FFF5F7',
          lavender: '#E8D5F5',
          mint: '#D5F0E8',
          butter: '#FFF3CC',
          rosegold: '#E891B8',
          darkgray: '#3D2C35',
        }
      },
      fontFamily: {
        heading: ['"Nunito"', 'sans-serif'],
        body: ['"Nunito"', 'sans-serif'],
        accent: ['"Caveat"', 'cursive'],
      }
    },
  },
  plugins: [],
}
