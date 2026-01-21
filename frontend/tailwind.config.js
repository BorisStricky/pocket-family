/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./src/stories/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      // Add custom design tokens here if needed
    },
  },
  plugins: [],
}
