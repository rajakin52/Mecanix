// React (Next.js / web) flavour. Adds react-hooks for the same reason
// expo.mjs does — to resolve // eslint-disable-line react-hooks/* comments
// — plus @next/next so existing @next/next/no-img-element disables resolve.
import reactHooks from 'eslint-plugin-react-hooks';
import nextPlugin from '@next/eslint-plugin-next';
import base from './base.mjs';

export default [
  ...base,
  {
    plugins: {
      'react-hooks': reactHooks,
      '@next/next': nextPlugin,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
      // Next.js plugin rules are explicitly off — they exist only so the
      // many `// eslint-disable-line @next/next/no-img-element` comments
      // in the codebase don't error as unknown rules. If we want the rules
      // active, enable them here.
      '@next/next/no-img-element': 'off',
    },
  },
];
