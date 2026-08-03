/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'xhs-red': '#FF2442',
        'xhs-bg': '#F5F5F5',
        'xhs-text': '#333333',
        'xhs-text-secondary': '#999999',
        'xhs-border': '#E8E8E8',
        'xhs-divider': '#EEEEEE',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          '"PingFang SC"',
          '"Hiragino Sans GB"',
          '"Microsoft YaHei"',
          'sans-serif',
        ],
      },
      borderRadius: {
        xhs: '6px',
        xhsCard: '8px',
        xhsTag: '14px',
      },
    },
  },
  plugins: [],
};
