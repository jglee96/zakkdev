/** @type {import('tailwindcss').Config} */
const { join } = require('path');
const { createGlobPatternsForDependencies } = require('@nrwl/next/tailwind');

module.exports = {
  mode: 'jit',
  purge: [
    join(__dirname, './src/**/*.{js,ts,jsx,tsx,mdx}'),
    ...createGlobPatternsForDependencies(__dirname),
  ],
  content: [join(__dirname, '/src/**/*.{js,ts,jsx,tsx,mdx}')],
  theme: {
    extend: {},
  },
  plugins: [],
  presets: [require('../../../tailwind-workspace-preset.js')],
};
