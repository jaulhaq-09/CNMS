export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ['Fraunces', 'ui-serif', 'Georgia', 'serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: '#0066cc',
        secondary: '#ff6600',
        success: '#00cc66',
        error: '#ff0000',
        warning: '#ffcc00',
      },
    },
  },
  plugins: [],
}