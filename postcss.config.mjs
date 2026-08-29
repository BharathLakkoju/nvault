// Tailwind CSS v4 ships its PostCSS integration as a separate plugin and
// handles vendor prefixing itself, so `autoprefixer` is no longer needed.
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
