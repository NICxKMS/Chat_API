module.exports = {
  plugins: [
    require('postcss-flexbugs-fixes'),
    require('postcss-preset-env')({
      autoprefixer: { flexbox: 'no-2009' },
      stage: 3
    }),
    ...(process.env.NODE_ENV === 'production'
      ? [require('@fullhuman/postcss-purgecss')({
          content: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
          defaultExtractor: content =>
            content.match(/[A-Za-z0-9-_:/]+/g) || []
        })]
      : [])
  ]
}; 