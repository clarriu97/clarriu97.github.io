/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
	darkMode: 'class',
	theme: {
    extend: {
      colors: {
        neon: {
          blue: "#00f3ff",
          purple: "#bc13fe",
          pink: "#ff00ff",
          green: "#0aff00",
        },
      },
      boxShadow: {
        "neon-blue": "0 0 10px #00f3ff, 0 0 20px #00f3ff",
        "neon-purple": "0 0 10px #bc13fe, 0 0 20px #bc13fe",
        "neon-pink": "0 0 10px #ff00ff, 0 0 20px #ff00ff",
      },
    },
	},
	plugins: [],
}
