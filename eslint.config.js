import js from '@eslint/js';
import tseslint from 'typescript-eslint';
export default tseslint.config(
  { ignores: ['**/dist/**'] },
  { languageOptions: { globals: { process: 'readonly', fetch: 'readonly', RequestInit: 'readonly', Response: 'readonly' } } },
  js.configs.recommended,
  ...tseslint.configs.recommended,
);
