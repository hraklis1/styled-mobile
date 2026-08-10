const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  // Global ignores must live in an object whose ONLY key is `ignores`. Paired
  // with `rules` (as these once were) flat config treats them as scoping for
  // that block instead, so the paths stay linted — and, worse, linted without
  // the rule relaxations below. Nested Claude Code worktrees under .claude/
  // then fail `npm run check` on rules this repo has deliberately turned off.
  { ignores: ['.agents/**', '.claude/**', 'dist/**'] },
  ...expoConfig,
  {
    rules: {
      // Existing modal and animation patterns rely on these established React
      // Native techniques. Keep conventional correctness linting active while
      // migrating compiler-oriented rules incrementally.
      'react-hooks/immutability': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react/no-unescaped-entities': 'off',
    },
  },
]);
