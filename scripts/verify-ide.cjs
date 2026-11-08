const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const { spawn, spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'chatagente-native-'));
  const fixture = path.join(directory, 'projeto ação');
  fs.mkdirSync(fixture);
  fs.writeFileSync(path.join(fixture, 'codigo.js'), 'console.log("projeto");\n');
  const git = spawnSync('git', ['init'], { cwd: fixture, encoding: 'utf8', windowsHide: true });
  if (git.status !== 0) throw new Error('Git não pôde iniciar o projeto de teste.');
  const port = await new Promise(resolve => { const server = net.createServer(); server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)); }); });
  const report = path.join(root, 'out', 'ide-test-report.json');
  for (const suffix of ['', '.screenshot-ready', '.screenshot-done']) if (fs.existsSync(report + suffix)) fs.unlinkSync(report + suffix);
  const env = { ...process.env, CHATAGENTE_TEST_FIXTURE: fixture, CHATAGENTE_TEST_REPORT: report,
    CODEX_HOME: path.join(directory, 'codex'), VSCODE_SKIP_PRELAUNCH: '1' };
  delete env.ELECTRON_RUN_AS_NODE;
  for (const name of Object.keys(env)) if (name.startsWith('VSCODE_') || name === 'NODE_COMPILE_CACHE') delete env[name];
  const executable = path.join(root, 'out', 'ide-app', 'ChatAgente.exe');
  const extension = path.join(root, 'out', 'ide-app', 'resources', 'app', 'extensions', 'chatagente');
  const child = spawn(executable, [fixture, '--user-data-dir', path.join(directory, 'profile'), '--extensions-dir', path.join(directory, 'extensions'),
    '--extensionDevelopmentPath', extension, '--extensionTestsPath', path.join(__dirname, 'ide-smoke-runner.cjs'),
    '--skip-welcome', '--skip-release-notes', '--disable-workspace-trust', '--new-window', `--remote-debugging-port=${port}`],
  { env, cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', data => { output = (output + data).slice(-12000); });
  child.stderr.on('data', data => { output = (output + data).slice(-12000); });
  const exited = new Promise(resolve => child.once('exit', code => resolve(code)));
  let closed = false; exited.then(() => { closed = true; });
  const deadline = Date.now() + 55000;
  while (!closed && !fs.existsSync(`${report}.screenshot-ready`) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
  if (fs.existsSync(`${report}.screenshot-ready`)) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = targets.find(target => target.type === 'page' && target.url.includes('workbench')) || targets.find(target => target.type === 'page');
      const socket = new WebSocket(page.webSocketDebuggerUrl);
      await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
      const screenshot = await new Promise(resolve => {
        socket.onmessage = event => { const message = JSON.parse(event.data); if (message.id === 1) resolve(message); };
        socket.send(JSON.stringify({ id: 1, method: 'Page.captureScreenshot', params: { format: 'png' } }));
      });
      socket.close();
      if (!screenshot.result?.data) throw new Error('Captura da IDE indisponível.');
      fs.writeFileSync(path.join(root, 'out', 'ide-native.png'), Buffer.from(screenshot.result.data, 'base64'));
    } finally { fs.writeFileSync(`${report}.screenshot-done`, 'done'); }
  }
  const code = closed ? await exited : await Promise.race([exited, new Promise(resolve => { const timer = setTimeout(() => resolve(null), 10000); timer.unref(); })]);
  if (code === null) spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
  if (code !== 0 || !fs.existsSync(report)) throw new Error(`Teste da IDE falhou (${code}).\n${output}`);
  console.log(fs.readFileSync(report, 'utf8'));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
