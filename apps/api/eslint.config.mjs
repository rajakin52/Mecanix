import nestjs from '@mecanix/eslint-config/nestjs';

export default [
  ...nestjs,
  {
    ignores: ['**/dist/**', '**/test/**/*.js', '**/*.spec.ts'],
  },
];
