import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "var(--color-cream)",
        ink: "var(--color-ink)",
        muted: "var(--color-muted)",
        line: "var(--color-line)",
        orange: "var(--color-orange)",
        blue: "var(--color-blue)",
        pink: "var(--color-pink)",
      },
      borderRadius: {
        card: "var(--radius-card)",
        pill: "var(--radius-pill)",
      },
      boxShadow: {
        soft: "var(--shadow-soft)",
        lift: "var(--shadow-lift)",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
      },
      spacing: {
        nav: "var(--bottom-nav-height)",
      },
      maxWidth: {
        app: "var(--page-max-width)",
      },
    },
  },
  plugins: [],
};

export default config;
