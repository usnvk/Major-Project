/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: '#2563EB',
          blueHover: '#1E40AF',
          teal: '#0D9488',
          bg: '#F8FAFC',
          card: '#FFFFFF',
          text: '#0F172A',
          muted: '#64748B',
          border: '#E2E8F0',
          success: '#16A34A',
          successBg: '#F0FDF4',
          warning: '#F59E0B',
          warningBg: '#FFFBEB',
          error: '#DC2626',
          errorBg: '#FEF2F2',
        },
        medical: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#2563EB',
          600: '#2563EB',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          teal: '#0D9488',
          dark: '#0f172a',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
