import js from '@eslint/js';
import globals from 'globals';

// ESLint's recommended rules, plus the invariants from CLAUDE.md that a linter can see in src/. Each group also
// catches the qualified spellings (window./globalThis./self.) and case or template-literal variants.
const TIMER_MSG = 'Use later() from core/util.js: the deterministic test harness steps it.',
  RAF_MSG = 'Only game/loop.js schedules frames.',
  DATE_MSG = 'No Date in game code (determinism).',
  CANVAS_MSG = 'Offscreen canvases come from mk() in gfx/canvas.js (CPU-backed).';
const GLOBALS = {
  timers: [
    { name: 'setTimeout', message: TIMER_MSG },
    { name: 'setInterval', message: TIMER_MSG },
  ],
  raf: [{ name: 'requestAnimationFrame', message: RAF_MSG }],
};
const SYNTAX = {
  timers: [{ selector: 'MemberExpression[property.name=/^(setTimeout|setInterval)$/]', message: TIMER_MSG }],
  raf: [{ selector: "MemberExpression[property.name='requestAnimationFrame']", message: RAF_MSG }],
  random: [
    { selector: "NewExpression[callee.name='Date']", message: DATE_MSG },
    { selector: "CallExpression[callee.name='Date']", message: DATE_MSG },
    { selector: "MemberExpression[object.name='Date'][property.name='now']", message: DATE_MSG },
    {
      selector: 'MemberExpression[property.name=/^(getRandomValues|randomUUID)$/]',
      message: 'Math.random and mulberry only (determinism).',
    },
  ],
  hex: [
    {
      selector: 'Literal[value=/^#[0-9a-fA-F]{3,8}$/]',
      message: 'Palette keys only: use PAL/U32 from core/palette.js.',
    },
    {
      selector: 'TemplateElement[value.raw=/^#[0-9a-fA-F]{3,8}$/]',
      message: 'Palette keys only: use PAL/U32 from core/palette.js.',
    },
  ],
  canvas: [
    {
      selector: "CallExpression[callee.property.name='createElement'][arguments.0.value=/^canvas$/i]",
      message: CANVAS_MSG,
    },
    {
      selector: "CallExpression[callee.property.name='createElement'][arguments.0.quasis.0.value.raw=/^canvas$/i]",
      message: CANVAS_MSG,
    },
    { selector: "NewExpression[callee.name='OffscreenCanvas']", message: CANVAS_MSG },
    { selector: "NewExpression[callee.property.name='OffscreenCanvas']", message: CANVAS_MSG },
  ],
};
// the rule settings for src/, minus the groups a file is allowed to use
const rules = (...allow) => ({
  'no-restricted-globals': ['error', ...Object.entries(GLOBALS).flatMap(([k, v]) => (allow.includes(k) ? [] : v))],
  'no-restricted-syntax': ['error', ...Object.entries(SYNTAX).flatMap(([k, v]) => (allow.includes(k) ? [] : v))],
});

export default [
  { ignores: ['dist/', 'test-results/', 'playwright-report/', 'tools/sprites/out/', '.claude/worktrees/'] },
  js.configs.recommended,
  { rules: { 'no-empty': ['error', { allowEmptyCatch: true }] } },
  { files: ['src/**/*.js'], languageOptions: { globals: globals.browser }, rules: rules() },
  { files: ['src/core/util.js'], rules: rules('timers') }, // later() wraps setTimeout
  { files: ['src/game/loop.js'], rules: rules('raf') },
  { files: ['src/core/palette.js'], rules: rules('hex') },
  { files: ['src/gfx/canvas.js'], rules: rules('canvas') }, // mk()
  {
    files: ['tests/**/*.js', 'scripts/**/*.mjs', '*.config.js'],
    languageOptions: { globals: { ...globals.node, ...globals.browser, APP: 'readonly' } },
  },
];
