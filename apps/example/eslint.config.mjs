import pluginNext from '@next/eslint-plugin-next';
import parser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
  {
    name: 'ESLint Config - nextjs',
    languageOptions: {
      parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
        project: './tsconfig.json'
      },
    },
    plugins: {
      '@next/next': pluginNext,
      '@typescript-eslint': tsPlugin
    },
    files: ['**/*.{js,mjs,cjs,ts,jsx,tsx}'],
    rules: {
      ...pluginNext.configs.recommended.rules,
      ...pluginNext.configs['core-web-vitals'].rules,
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'inline-type-imports',
          disallowTypeAnnotations: true
        }
      ],
      'import/consistent-type-specifier-style': ['error', 'prefer-inline'],
      'import/no-duplicates': ['error', { 'prefer-inline': true }]
    },
  },
];