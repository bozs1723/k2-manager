import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        k2: {
          ink: "#14383d",
          muted: "#637f82",
          cloud: "#f4fbfa",
          mint: "#b3dfde",
          peach: "#d8f0ee",
          lilac: "#c7ecea",
          sky: "#d7f4f2",
          rose: "#e6f6f5"
        }
      },
      boxShadow: {
        glass: "0 24px 80px rgba(37, 143, 151, 0.14)"
      },
      fontFamily: {
        sans: ["Nunito", "Noto Sans Thai", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Nunito", "Noto Sans Thai", "ui-sans-serif", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
