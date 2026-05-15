import react from '@mecanix/eslint-config/react';

export default [
  ...react,
  {
    ignores: ['.next/**', 'next-env.d.ts'],
  },
];
