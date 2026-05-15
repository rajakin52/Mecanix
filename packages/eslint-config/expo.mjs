// Expo / React Native flavour. Adds react-hooks rules so the existing
// // eslint-disable-line react-hooks/exhaustive-deps comments resolve
// (ESLint v9 errors on unknown rule disables).
import reactHooks from 'eslint-plugin-react-hooks';
import base from './base.mjs';

export default [
  ...base,
  {
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];
