// Flat ESLint config (v9+) shared by all packages. Permissive by design:
// every rule is `warn` so CI doesn't fail on style — the goal is to get
// lint running again, not to clean up the codebase. Tighten over time.
import globals from 'globals';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.turbo/**',
      '**/.next/**',
      '**/.expo/**',
      '**/coverage/**',
      '**/build/**',
      '**/*.d.ts',
    ],
  },
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
        ...globals.es2022,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      // Intentionally OFF. The autofix is unsafe in NestJS — converting
      // a decorated constructor-injected class to `import type` drops
      // the runtime symbol, breaking DI. Re-enable selectively if/when
      // we wire a separate config layer for non-Nest code.
      '@typescript-eslint/consistent-type-imports': 'off',
      // The legacy config errored on these; keep them as warnings so CI
      // doesn't turn red on every PR while we triage the existing backlog.
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/no-require-imports': 'warn',
      '@typescript-eslint/no-unsafe-function-type': 'warn',
      'no-empty': 'warn',
      'no-prototype-builtins': 'warn',
      'no-useless-escape': 'warn',
    },
  },
  eslintConfigPrettier,
];
