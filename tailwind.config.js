/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#050505',
          secondary: '#000000',
          card: '#121212',
          hover: '#1a1a1a',
        },
        border: {
          DEFAULT: '#1c1c1c',
          light: '#2c2c2c',
        },
        accent: {
          gold: '#D5FF40',
          'gold-light': '#e6ff80',
          'gold-dark': '#b3db1b',
          purple: '#8B5CF6',
          'purple-light': '#A78BFA',
          blue: '#3B82F6',
          green: '#D5FF40',
          red: '#EF4444',
          orange: '#F97316',
        },
        text: {
          primary: '#F1F5F9',
          secondary: '#C0C2B8',
          muted: '#5e6158',
        },
      },
      fontFamily: {
        sans: ['Poppins', 'Inter', 'system-ui', 'sans-serif'],
        display: ['Poppins', 'Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-gold': 'linear-gradient(135deg, #D5FF40, #b3db1b)',
        'gradient-purple': 'linear-gradient(135deg, #8B5CF6, #6D28D9)',
        'gradient-card': 'linear-gradient(135deg, #121212, #1a1a1a)',
        'glow-gold': 'radial-gradient(ellipse at center, rgba(213,255,64,0.15) 0%, transparent 70%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'pulse-gold': 'pulseGold 2s ease-in-out infinite',
        'spin-slow': 'spin 3s linear infinite',
        shimmer: 'shimmer 2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        pulseGold: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      boxShadow: {
        'gold': '0 0 20px rgba(213,255,64,0.3)',
        'gold-sm': '0 0 10px rgba(213,255,64,0.2)',
        'card': '0 4px 24px rgba(0,0,0,0.4)',
        'card-hover': '0 8px 40px rgba(0,0,0,0.6)',
      },
    },
  },
  plugins: [],
};
