const fs = require('fs');

fs.mkdirSync('build/chrome-mv3-dev', { recursive: true });
fs.cpSync('_locales', 'build/chrome-mv3-dev/_locales', { recursive: true });
fs.readdirSync('public')
  .filter(f => f.endsWith('.png'))
  .forEach(f => fs.copyFileSync(`public/${f}`, `build/chrome-mv3-dev/${f}`));

if (fs.existsSync('public/dictionaries')) {
  fs.cpSync('public/dictionaries', 'build/chrome-mv3-dev/dictionaries', { recursive: true });
}
