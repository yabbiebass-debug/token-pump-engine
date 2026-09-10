/** @type {import('tailwindcss').Config} */
module.exports = {
    // `overline` is a Tailwind utility; without this an app's own eyebrow-label class draws a line above the text.
    blocklist: ["overline"],
    darkMode: ["class"],
    content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))'
        },
        void: '#090a0f',
        panel: '#11141e',
        panel2: '#181d2c',
        panel3: '#22293e',
        line: 'rgba(153, 69, 255, 0.22)',
        'line-subtle': 'rgba(255, 255, 255, 0.08)',
        purple: { DEFAULT: '#9945ff', hover: '#8033e0' },
        green: { DEFAULT: '#14f195', hover: '#0ed180' },
        amber: '#f5a623',
        red: '#ff4d5a',
        ink: '#f0f3f8',
        dim: '#9aa3b5',
        dim2: '#626c82'
      },
      fontFamily: {
        display: ['Unbounded', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace']
      },
      keyframes: {
        'fade-up': { from: { opacity: '0', transform: 'translateY(14px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        ticker: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
        'pulse-ring': { '0%': { transform: 'scale(0.35)', opacity: '0.9' }, '100%': { transform: 'scale(1)', opacity: '0' } },
        flow: { from: { 'stroke-dashoffset': '24' }, to: { 'stroke-dashoffset': '0' } },
        glow: { '0%,100%': { boxShadow: '0 0 0 rgba(20,241,149,0)' }, '50%': { boxShadow: '0 0 22px rgba(20,241,149,0.35)' } },
        'accordion-down': {
          from: {
            height: '0'
          },
          to: {
            height: 'var(--radix-accordion-content-height)'
          }
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)'
          },
          to: {
            height: '0'
          }
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-up': 'fade-up 0.6s cubic-bezier(0.22,1,0.36,1) both',
        ticker: 'ticker 40s linear infinite',
        'pulse-ring': 'pulse-ring 1.6s ease-out infinite',
        flow: 'flow 1s linear infinite',
        glow: 'glow 2.4s ease-in-out infinite'
      }
    }
  },
  plugins: [require("tailwindcss-animate")],
};