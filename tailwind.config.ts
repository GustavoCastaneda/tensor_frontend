/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        'montserrat': ['Montserrat', 'sans-serif'],
      },
      colors: {
        
        'curious-blue': {
          '50': '#f0f9ff',
          '100': '#e0f2fe',
          '200': '#b9e7fe',
          '300': '#7cd4fd',
          '400': '#36c0fa',
          '500': '#0ca8eb',
          '600': '#008ace',
          '700': '#016ba3',
          '800': '#065a86',
          '900': '#0b4b6f',
          '950': '#07304a',
         },    
        'cerulean-blue': {
          '50': '#ecfaff',
          '100': '#d4f2ff',
          '200': '#b2e9ff',
          '300': '#7ddeff',
          '400': '#40c8ff',
          '500': '#14a7ff',
          '600': '#0086ff',
          '700': '#006eff',
          '800': '#0056c7',
          '900': '#084da0',
          '950': '#0a2f61',
        },
        'electric-lime': {
          '300': '#ddff50',
          '400': '#ceff2a',
        },
      },
    },
  },
  plugins: [],
}

