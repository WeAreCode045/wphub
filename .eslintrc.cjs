module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  rules: {
    // ========================================================================
    // MONOREPO TYPE SAFETY RULES
    // ========================================================================
    
    // Forbid local type definitions (force use of @wphub/types)
    '@typescript-eslint/no-empty-interface': 'warn',
    
    // Enforce PascalCase for types and interfaces
    '@typescript-eslint/naming-convention': [
      'error',
      {
        selector: 'typeLike',
        format: ['PascalCase'],
      },
      {
        selector: 'interface',
        format: ['PascalCase'],
        prefix: ['I'],
        // Exception: interfaces from @wphub/types don't need 'I' prefix
        filter: {
          regex: '^(User|Site|Plugin|Team|Message|Notification|Activity|Connector|Subscription).*',
          match: false,
        },
      },
    ],

    // Forbid direct fetch calls to Edge Functions (use @wphub/api-client)
    'no-restricted-syntax': [
      'error',
      {
        selector: "CallExpression[callee.object.name='supabase'][callee.property.name='functions']",
        message: 'Use @wphub/api-client instead of direct supabase.functions.invoke() calls',
      },
      {
        selector: "CallExpression[callee.name='fetch'][arguments.0.value=/\\/functions\\//]",
        message: 'Use @wphub/api-client instead of direct fetch() calls to Edge Functions',
      },
    ],

    // Warn about any/unknown types (encourage proper typing)
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unsafe-assignment': 'off', // Too strict for gradual migration
    '@typescript-eslint/no-unsafe-member-access': 'off',
    '@typescript-eslint/no-unsafe-call': 'off',

    // React rules
    'react/react-in-jsx-scope': 'off', // Not needed in React 17+
    'react/prop-types': 'off', // Using TypeScript for prop validation
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  ignorePatterns: ['dist', 'node_modules', '.eslintrc.cjs', 'vite.config.js'],
};
