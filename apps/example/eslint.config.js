import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all
});

export default [
  ...compat.config({
    extends: [
      'airbnb-typescript',
      'next/core-web-vitals',
      'next/typescript',
      'prettier'
    ],
    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint', 'import'],
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'inline-type-imports',
          disallowTypeAnnotations: true,
        },
      ],
      'import/consistent-type-specifier-style': ['error', 'prefer-inline'],
      'import/no-duplicates': ['error', { 'prefer-inline': true }],
    },
    parserOptions: {
      project: './tsconfig.json',
      sourceType: 'module',
    },
    settings: {
      'import/resolver': {
        typescript: true,
      },
    },
  })
];