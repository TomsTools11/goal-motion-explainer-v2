// Builds the single-file pages: inlines src/styles.css, src/main.js and the logo PNGs (as data URIs)
// into dist/goal-explainer.html (player) and dist/goal-explainer-autoplay.html (clean), then copies
// them to public/ for Vercel.
// Usage: node build.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, 'src');
const dist = join(root, 'dist');

mkdirSync(dist, { recursive: true });

let html = readFileSync(join(src, 'index.html'), 'utf8');
const css = readFileSync(join(src, 'styles.css'), 'utf8');
const js = readFileSync(join(src, 'main.js'), 'utf8');

// The logos are already sized for the stage (mark 400px, wordmark 1200px wide), so the build is the same on macOS and Linux.
const images = ['goal-mark-400.png', 'goal-wordmark-white-1200.png'];
for (const name of images) {
  const file = join(root, 'assets', name);
  if (!existsSync(file)) throw new Error('Missing image: ' + file);
  const ref = 'src="../assets/' + name + '"';
  const uses = html.split(ref).length - 1;
  if (!uses) throw new Error('No reference to ' + name + ' in src/index.html');
  html = html.split(ref).join('src="data:image/png;base64,' + readFileSync(file).toString('base64') + '"');
  console.log(`inlined ${name} (${uses} use${uses === 1 ? '' : 's'}, ${(statSync(file).size / 1024).toFixed(0)} KB)`);
}

html = html.replace('<link rel="stylesheet" href="styles.css">', () => '<style>\n' + css + '\n</style>');

// Two builds from one source: the full player, and a clean version with no control bar and no captions.
const builds = [
  { file: 'goal-explainer.html', js: js },
  { file: 'goal-explainer-autoplay.html', js: js.replace('controls: true', 'controls: false').replace('captions: true', 'captions: false') }
];
for (const b of builds) {
  if (b.file.includes('autoplay') && !(b.js.includes('controls: false') && b.js.includes('captions: false'))) throw new Error('Could not switch CONFIG controls and captions off.');
  const page = html.replace('<script src="main.js"></script>', () => '<script>\n' + b.js + '\n</script>');
  if (page.includes('href="styles.css"') || page.includes('src="main.js"') || page.includes('../assets/')) throw new Error('A src reference was not inlined.');
  const out = join(dist, b.file);
  writeFileSync(out, page);
  const kb = statSync(out).size / 1024;
  console.log(`wrote ${resolve(out)} (${kb.toFixed(0)} KB)`);
  if (kb > 1536) console.warn('WARNING: built file is over 1.5 MB');
}

// Deploy output for Vercel: the clean autoplay build at the site root, the full player at /player.
const pub = join(root, 'public');
mkdirSync(pub, { recursive: true });
writeFileSync(join(pub, 'index.html'), readFileSync(join(dist, 'goal-explainer-autoplay.html')));
writeFileSync(join(pub, 'player.html'), readFileSync(join(dist, 'goal-explainer.html')));
console.log('wrote public/index.html (autoplay) and public/player.html (full player)');
