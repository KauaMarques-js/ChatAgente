const { spawn } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const build = spawn(process.execPath, [path.join(__dirname, 'build-ide.cjs'), '--prepare'], { cwd: root, stdio: 'inherit', windowsHide: true });
build.on('error', error => { console.error(error.message); process.exitCode = 1; });
build.on('exit', code => {
  if (code !== 0) { process.exitCode = code || 1; return; }
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  for (const name of Object.keys(env)) if (name.startsWith('VSCODE_') || name === 'NODE_COMPILE_CACHE') delete env[name];
  const ide = spawn(path.join(root, 'out', 'ide-app', 'ChatAgente.exe'), process.argv.slice(2), { cwd: root, env, stdio: 'inherit', windowsHide: true });
  ide.on('error', error => { console.error(error.message); process.exitCode = 1; });
  ide.on('exit', status => { process.exitCode = status || 0; });
});
