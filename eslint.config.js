import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'art', 'test/fixtures', 'test/app'] },
  js.configs.recommended,
  { files: ['scripts/**'], languageOptions: { globals: { process: 'readonly', console: 'readonly' } } },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
)
