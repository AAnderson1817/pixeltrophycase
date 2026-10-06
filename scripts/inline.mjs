// Folds the Vite build into one self-contained HTML file (dist/pixeltrophycase.html) for publishing or sharing.
import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve('dist');
let html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(dist, 'app.js'), 'utf8').replace(/<\/script/gi, '<\\/script');
const css = fs.readFileSync(path.join(dist, 'app.css'), 'utf8');
html = html.replace(/<script type="module"[^>]*src="\.\/app\.js"[^>]*><\/script>/, () => `<script type="module">\n${js}\n</script>`);
html = html.replace(/<link rel="stylesheet"[^>]*href="\.\/app\.css"[^>]*>/, () => `<style>\n${css}\n</style>`);
if (html.includes('app.js') || html.includes('app.css')) throw new Error('inline: a reference to app.js/app.css survived');
fs.writeFileSync(path.join(dist, 'pixeltrophycase.html'), html);
console.log(`dist/pixeltrophycase.html  ${(html.length / 1024).toFixed(1)} kB`);
