/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: {
          50: '#EEF7F2',
          100: '#D5EBDF',
          200: '#A9D7BE',
          300: '#74BE94',
          400: '#3F9E6E',
          500: '#23804F',
          600: '#176B45',
          700: '#135737',
          800: '#10472D',
          900: '#0C3322',
        },
        secondary: {
          50: '#FAFDFB',
          100: '#E8F5EC',
          200: '#CFEAD8',
          300: '#A8DBB9',
          400: '#7AC496',
        },
        accent: {
          50: '#FEF6EA',
          100: '#FDE9C9',
          200: '#FBD597',
          300: '#F8C06A',
          400: '#F4A340',
          500: '#E88A1E',
          600: '#B86A0E',
          700: '#8F5309',
        },
        success: {
          50: '#ECFDF3',
          100: '#D1FADF',
          500: '#12B76A',
          600: '#039855',
          700: '#027A48',
        },
        warning: {
          50: '#FFFAEB',
          100: '#FEF0C7',
          500: '#F79009',
          600: '#B54708',
          700: '#93370D',
        },
        error: {
          50: '#FEF3F2',
          100: '#FEE4E2',
          500: '#F04438',
          600: '#D92D20',
          700: '#B42318',
        },
        neutral: {
          50: '#FAFCF9',
          100: '#F1F4F1',
          200: '#E2E8E3',
          300: '#C9D2CB',
          400: '#98A49C',
          500: '#6B7770',
          600: '#4B5750',
          700: '#37423B',
          800: '#24312A',
          900: '#18201B',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(36, 49, 42, 0.04), 0 8px 24px -12px rgba(36, 49, 42, 0.12)',
        lift: '0 4px 8px rgba(36, 49, 42, 0.06), 0 24px 48px -16px rgba(23, 107, 69, 0.25)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.6s ease-out both',
        'fade-in': 'fade-in 0.2s ease-out both',
      },
    },
  },
  plugins: [],
};
