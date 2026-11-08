const { spawn } = require('node:child_process');
const path = require('node:path');

const electronPath = require('electron');
const env = { ...process.env };
// O Codex e outros terminais dentro do Electron podem herdar essa variável.
// Ela transforma o Electron em Node e impediria a janela de abrir.
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronPath, [path.resolve(__dirname, '..')], {
  cwd: path.resolve(__dirname, '..'),
  stdio: 'inherit',
  env,
});
child.on('error', error => { console.error(`Erro ao abrir Electron: ${error.message}`); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
