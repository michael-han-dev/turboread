import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend:{
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'sans-serif'],
        serif: ['var(--font-instrument-serif)', 'serif'],
      },
      colors: {
        border: "hsl(var(--border) / <alpha-value>)",
        slate: {
          1: "var(--slate1)",
          2: "var(--slate2)",
          3: "var(--slate3)",
          4: "var(--slate4)",
          5: "var(--slate5)",
          6: "var(--slate6)",
          7: "var(--slate7)",
          8: "var(--slate8)",
          9: "var(--slate9)",
          10: "var(--slate10)",
          11: "var(--slate11)",
          12: "var(--slate12)",
        },
        gray: {
          1: "var(--gray1)",
          2: "var(--gray2)",
          3: "var(--gray3)",
          4: "var(--gray4)",
          5: "var(--gray5)",
          6: "var(--gray6)",
          7: "var(--gray7)",
          8: "var(--gray8)",
          9: "var(--gray9)",
          10: "var(--gray10)",
          11: "var(--gray11)",
          12: "var(--gray12)",
        },
        white: "#ffffff",
        black: "#000000",
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        card: "hsl(var(--card) / <alpha-value>)",
        "card-foreground": "hsl(var(--card-foreground) / <alpha-value>)",
        popover: "hsl(var(--popover) / <alpha-value>)",
        "popover-foreground": "hsl(var(--popover-foreground) / <alpha-value>)",
        primary: "hsl(var(--primary) / <alpha-value>)",
        "primary-foreground": "hsl(var(--primary-foreground) / <alpha-value>)",
      },
      fontSize: {
        "2xs": [
          "11px",
          {
            lineHeight: "1.3",
            letterSpacing: "-0.3px",
            fontWeight: "300",
          },
        ],
        xs: [
          "0.75rem",
          {
            lineHeight: "1rem",
            letterSpacing: "-0.36px",
            fontWeight: "300",
          },
        ],
        sm: ["0.875rem", { lineHeight: "1.25rem", letterSpacing: "-0.42px" }],
        base: ["1rem", { lineHeight: "1.6", letterSpacing: "-0.48px" }],
        lg: ["1.125rem", { lineHeight: "1.75rem", letterSpacing: "-0.72px" }],
        xl: ["1.25rem", { lineHeight: "1.75rem", letterSpacing: "-0.8px" }],
        "2xl": ["1.5rem", { lineHeight: "2rem", letterSpacing: "-1.12px" }],
        "3xl": ["1.75rem", { lineHeight: "2.25rem", letterSpacing: "-1.2px" }],
        "4xl": ["2.25rem", { lineHeight: "2.5rem", letterSpacing: "-1.44px" }],
        "5xl": ["3rem", { letterSpacing: "-1.6px" }],
        "6xl": ["3.75rem", { letterSpacing: "-1.8px" }],
        "7xl": ["4.5rem", { letterSpacing: "-2px" }],
        "8xl": ["6rem", { letterSpacing: "-2.4px" }],
        "9xl": ["8rem", { letterSpacing: "-3.2px" }],
      },
      letterSpacing: {
        tighter: "-0.58px",
        tight: "-0.48px",
      },
      typography: {
        DEFAULT: {
          css: {
            p: {
              letterSpacing: "-0.48px",
            },
            code: {
              letterSpacing: "normal",
            },
          },
        },
      },
    },
    plugins: [require("tailwindcss-animate")],
  }
};
export default config;
