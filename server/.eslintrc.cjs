module.exports = {
  root: true,
  env: { node: true, es2022: true },
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  ignorePatterns: ['dist/', 'node_modules/', 'prisma/'],
  rules: {
    // Los sockets y los handlers de Express usan(req, res, next) donde
    // algunos parametros no se usan; se permite con prefijo _
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    // El codigo real interactua con req.body de Express, que es `any`
    '@typescript-eslint/no-explicit-any': 'warn',
    'no-console': 'off',
    eqeqeq: ['error', 'smart'],
    'prefer-const': 'error',
    'no-var': 'error',
  },
};