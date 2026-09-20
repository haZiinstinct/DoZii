import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
  { ignores: ['out/**', 'dist/**', 'node_modules/**', 'build/**', '*.config.*'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Initial-Fetch + setState im Effect ist hier bewusstes Muster (kein React Compiler im Einsatz)
      'react-hooks/set-state-in-effect': 'off'
    }
  },
  {
    // Werkzeuge, die in einem echten Electron laufen muessen und deshalb
    // CommonJS sind - sie werden nicht mitgebaut, nur von Hand gestartet.
    files: ['scripts/**/*.cjs'],
    languageOptions: { globals: { require: 'readonly', process: 'readonly', module: 'writable' } },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'no-console': 'off'
    }
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      'no-console': ['warn', { allow: ['warn', 'error'] }]
    }
  },
  prettier
)
