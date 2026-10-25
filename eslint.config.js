// ESLint สำหรับตรวจโค้ดตอนพัฒนาเท่านั้น (ไม่อยู่ใน Docker image)
const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  { ignores: ['node_modules/', 'backend/data/runtime/'] },
  js.configs.recommended,
  {
    files: ['backend/**/*.js', 'tests/**/*.js', 'eslint.config.js'],
    languageOptions: { sourceType: 'commonjs', globals: globals.node },
  },
  {
    files: ['frontend/**/*.js'],
    languageOptions: { sourceType: 'module', globals: { ...globals.browser, L: 'readonly' } },
  },
  {
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrors: 'none', ignoreRestSiblings: true }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
];
