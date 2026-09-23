// After `vite build`: derive dist/artifact.html from dist/index.html for publishing as a claude.ai artifact.
// The artifact host wraps pages in its own <!doctype>/<html>/<head>/<body> skeleton (charset + viewport meta
// included), so the published file carries only the title, font links, styles, markup and the inlined script.
import { readFileSync, writeFileSync, statSync } from 'node:fs';

const html = readFileSync('dist/index.html', 'utf8');
const head = html.match(/<head>([\s\S]*?)<\/head>/i)[1];
const body = html.match(/<body>([\s\S]*?)<\/body>/i)[1];
const keepHead = head
  .replace(/<meta charset[^>]*>\s*/i, '')
  .replace(/<meta name="viewport"[^>]*>\s*/i, '')
  .trim();
const out = keepHead + '\n' + body.trim() + '\n';
if (!/^<title>/.test(out))
  throw new Error('artifact must start with its <title> (the host reads the first 8KB for it)');
writeFileSync('dist/artifact.html', out);
const kb = (f) => (statSync(f).size / 1024).toFixed(1) + ' KB';
console.log(`dist/index.html ${kb('dist/index.html')}  ->  dist/artifact.html ${kb('dist/artifact.html')}`);
