/**
 * Entry point. errors.js is imported first so its window 'error' handler is live before any other module evaluates.
 */
import './core/errors.js';
import './styles.css';
import { showErr } from './core/errors.js';
import { boot } from './game/loop.js';

try {
  boot();
} catch (e) {
  showErr(e.message);
  console.error(e.stack);
}
