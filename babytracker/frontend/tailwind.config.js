/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        'pastel-mint': '#D4F4DD',
        'pastel-lavender': '#E3D5FF',
        'pastel-peach': '#FFE5CC',
        'pastel-sky': '#D4E8FF',
        'pastel-rose': '#FFD5E5',
      },
    },
  },
  plugins: [],
};
