import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: ["class"],
    content: [
        "./pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        container: {
            center: true,
            padding: "2rem",
            screens: {
                "2xl": "1400px",
            },
        },
        extend: {
            colors: {
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                card: {
                    DEFAULT: "hsl(var(--card))",
                    foreground: "hsl(var(--card-foreground))",
                },
                popover: {
                    DEFAULT: "hsl(var(--popover))",
                    foreground: "hsl(var(--popover-foreground))",
                },
                primary: {
                    DEFAULT: "hsl(var(--primary))",
                    foreground: "hsl(var(--primary-foreground))",
                },
                secondary: {
                    DEFAULT: "hsl(var(--secondary))",
                    foreground: "hsl(var(--secondary-foreground))",
                },
                muted: {
                    DEFAULT: "hsl(var(--muted))",
                    foreground: "hsl(var(--muted-foreground))",
                },
                accent: {
                    DEFAULT: "hsl(var(--accent))",
                    foreground: "hsl(var(--accent-foreground))",
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive))",
                    foreground: "hsl(var(--destructive-foreground))",
                },
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                chart: {
                    "1": "hsl(var(--chart-1))",
                    "2": "hsl(var(--chart-2))",
                    "3": "hsl(var(--chart-3))",
                    "4": "hsl(var(--chart-4))",
                    "5": "hsl(var(--chart-5))",
                },
                customRed: {
                    "50": "#FFF1F0",
                    "100": "#FFDDDB",
                    "200": "#FFB7B2",
                    "300": "#FF918A",
                    "400": "#FF6A61",
                    "500": "#FF4438",
                    "600": "#FF0F00",
                    "700": "#C70C00",
                    "800": "#8F0900",
                    "900": "#570500",
                    DEFAULT: "#FF4438",
                },
                red: {
                    "50": "#FFF1F0",
                    "100": "#FFDDDB",
                    "200": "#FFB7B2",
                    "300": "#FF918A",
                    "400": "#FF6A61",
                    "500": "#FF4438",
                    "600": "#FF0F00",
                    "700": "#C70C00",
                    "800": "#8F0900",
                    "900": "#570500",
                    DEFAULT: "#FF4438",
                },
                customSlate: {
                    "50": "#e6f1f7",
                    "100": "#347798",
                    "200": "#2e6885",
                    "300": "#275972",
                    "400": "#214a5f",
                    "500": "#1a3b4c",
                    "600": "#163341",
                    "700": "#142c39",
                    "800": "#0d1e26",
                    "900": "#070f13",
                    "950": "#000000",
                    DEFAULT: "#163341",
                },
                customLime: {
                    "50": "#F7FFD0",
                    "100": "#F3FFBB",
                    "200": "#ECFF92",
                    "300": "#E4FF6A",
                    "400": "#DDFF41",
                    "500": "#D6FF18",
                    "600": "#B7DF00",
                    "700": "#89A700",
                    "800": "#5B6F00",
                    "900": "#2D3700",
                    "950": "#161B00",
                    DEFAULT: "#D6FF18",
                },
                alternative: {
                    "50": "#FBFBE2",
                    "100": "#F8F9D0",
                    "200": "#F3F5AC",
                    "300": "#EDF087",
                    "400": "#E8EC63",
                    "500": "#E3E73F",
                    "600": "#DCE11C",
                    "700": "#ABAF16",
                    "800": "#7A7D10",
                    "900": "#4A4B09",
                    "950": "#313206",
                    DEFAULT: "#DCE11C",
                },
                sidebar: {
                    DEFAULT: "hsl(var(--sidebar-background))",
                    foreground: "hsl(var(--sidebar-foreground))",
                    primary: "hsl(var(--sidebar-primary))",
                    "primary-foreground":
                        "hsl(var(--sidebar-primary-foreground))",
                    accent: "hsl(var(--sidebar-accent))",
                    "accent-foreground":
                        "hsl(var(--sidebar-accent-foreground))",
                    border: "hsl(var(--sidebar-border))",
                    ring: "hsl(var(--sidebar-ring))",
                },
            },
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 2px)",
                sm: "calc(var(--radius) - 4px)",
            },
            keyframes: {
                "accordion-down": {
                    from: {
                        height: "0",
                    },
                    to: {
                        height: "var(--radix-accordion-content-height)",
                    },
                },
                "accordion-up": {
                    from: {
                        height: "var(--radix-accordion-content-height)",
                    },
                    to: {
                        height: "0",
                    },
                },
            },
            animation: {
                "accordion-down": "accordion-down 0.2s ease-out",
                "accordion-up": "accordion-up 0.2s ease-out",
            },
        },
    },
    plugins: [require("tailwindcss-animate")],
}
export default config;
