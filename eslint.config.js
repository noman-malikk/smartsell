import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest', sourceType: 'module',
      globals: Object.fromEntries(['AbortController', 'AbortSignal', 'WebSocket', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'document', 'window', 'navigator', 'localStorage', 'innerWidth', 'console', 'process', 'URL'].map(name => [name, 'readonly'])),
    },
    rules: { 'no-unused-vars': ['error', { caughtErrors: 'none' }], 'no-constant-binary-expression': 'error' },
  },
];
