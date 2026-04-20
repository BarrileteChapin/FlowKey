const { execSync } = require('child_process');
const path = require('path');

const entries = ['hud', 'flow-editor', 'accessibility'];
const webviewDir = path.resolve(__dirname, '..', 'webview-ui');

for (const entry of entries) {
  console.log(`\n[webview] Building ${entry}...`);
  execSync(`npx vite build`, {
    cwd: webviewDir,
    stdio: 'inherit',
    env: { ...process.env, ENTRY: entry },
  });
}

console.log('\n[webview] All entries built.');
