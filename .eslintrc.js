module.exports = {
  root: true,
  extends: ['./packages/config/eslint/base.js'],
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'build/',
    'coverage/',
    '*.config.js',
    '*.config.ts',
    '.eslintrc.js',
    'venv/',
    '__pycache__/',
    'htmlcov/',
  ],
  overrides: [
    {
      files: ['apps/web/**/*.{ts,tsx}'],
      extends: ['./packages/config/eslint/react.js'],
    },
    {
      files: ['packages/**/*.{ts,tsx}'],
      extends: ['./packages/config/eslint/base.js'],
    },
  ],
};