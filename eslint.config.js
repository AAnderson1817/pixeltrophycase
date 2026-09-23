import js from '@eslint/js';
import globals from 'globals';

// ESLint's recommended rules, plus the invariants from CLAUDE.md that a linter can see in src/.
const TIMERS = [
  { name: 'setTimeout', message: 'Use later() from core/util.js: the deterministic test harness steps it.' },
  { name: 'setInterval', message: 'Use later() from core/util.js: the deterministic test harness steps it.' },
];
const RAF = { name: 'requestAnimationFrame', message: 'Only game/loop.js schedules frames.' };
const NO_DATE = { selector: "NewExpression[callee.name='Date']", message: 'No Date in game code (determinism).' };
const NO_HEX = {
  selector: 'Literal[value=/^#[0-9a-fA-F]{3,8}$/]',
  message: 'Palette keys only: use PAL/U32 from core/palette.js.',
};
const NO_CANVAS = [
  {
    selector: "CallExpression[callee.property.name='createElement'][arguments.0.value='canvas']",
    message: 'Offscreen canvases come from mk() in gfx/canvas.js (CPU-backed).',
  },
  { selector: "NewExpression[callee.name='OffscreenCanvas']", message: 'Use mk() from gfx/canvas.js.' },
];

export default [
  { ignores: ['dist/', 'test-results/', 'playwright-report/', 'tools/sprites/out/', '.claude/worktrees/'] },
  js.configs.recommended,
  { rules: { 'no-empty': ['error', { allowEmptyCatch: true }] } },
  {
    files: ['src/**/*.js'],
    languageOptions: { globals: globals.browser },
    rules: {
      'no-restricted-globals': ['error', ...TIMERS, RAF],
      'no-restricted-properties': [
        'error',
        { object: 'crypto', property: 'getRandomValues', message: 'Math.random and mulberry only (determinism).' },
        { object: 'Date', property: 'now', message: 'No Date in game code (determinism).' },
      ],
      'no-restricted-syntax': ['error', NO_DATE, NO_HEX, ...NO_CANVAS],
    },
  },
  { files: ['src/core/util.js'], rules: { 'no-restricted-globals': ['error', RAF] } },
  { files: ['src/game/loop.js'], rules: { 'no-restricted-globals': ['error', ...TIMERS] } },
  { files: ['src/core/palette.js'], rules: { 'no-restricted-syntax': ['error', NO_DATE, ...NO_CANVAS] } },
  { files: ['src/gfx/canvas.js'], rules: { 'no-restricted-syntax': ['error', NO_DATE, NO_HEX] } },
  {
    files: ['tests/**/*.js', 'scripts/**/*.mjs', '*.config.js'],
    languageOptions: { globals: { ...globals.node, ...globals.browser, APP: 'readonly' } },
  },
];
