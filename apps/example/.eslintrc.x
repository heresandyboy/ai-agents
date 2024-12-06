{
  "extends": [
    "next/core-web-vitals",
    "next/typescript",
    "prettier"
  ],
  "parser": "@typescript-eslint/parser",
  "plugins": ["@typescript-eslint", "import"],
  "rules": {
    "@typescript-eslint/consistent-type-imports": [
      "error",
      {
        "prefer": "type-imports",
        "fixStyle": "inline-type-imports",
        "disallowTypeAnnotations": true
      }
    ],
    "import/consistent-type-specifier-style": ["error", "prefer-inline"],
    "import/no-duplicates": ["error", {"prefer-inline": true}]
  },
  "parserOptions": {
    "project": "./tsconfig.json",
    "sourceType": "module"
  },
  "settings": {
    "import/resolver": {
      "typescript": true
    }
  }
}