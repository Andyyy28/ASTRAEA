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
          blush: '#FDEEF4',
          rosegold: '#C9906A',
          darkgray: '#2D2D2D',
        }
      },
      fontFamily: {
        heading: ['"Playfair Display"', 'serif'],
        body: ['Lato', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
