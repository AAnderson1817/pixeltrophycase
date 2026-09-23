/**
 * On-page error banner (showErr) and the window 'error' hook that feeds it.
 */
const errBox = document.getElementById('err');

/** Shows a visible error banner; the game keeps no silent failures. */
export function showErr(m) {
  errBox.style.display = 'block';
  errBox.textContent = 'Something broke: ' + m;
}

window.addEventListener('error', (e) => showErr(e.message));
