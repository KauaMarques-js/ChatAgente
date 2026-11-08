const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

const IGNORED_DIRS = new Set(['node_modules', '.git', '.next', 'dist', 'build', '.venv', 'coverage']);
const PRIVATE_FILES = /(^|[\\/])(\.env(?:\..*)?|id_rsa(?:\.pub)?|id_ed25519(?:\.pub)?|[^\\/]+\.(?:pem|key|p12|pfx))$/i;
const LIMIT = 14_000;

function hash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function assertSafeFileName(relativePath) {
  if (PRIVATE_FILES.test(relativePath) || relativePath.split(/[\\/]/).includes('.git')) {
    throw new Error('Arquivo sensível ou interno do Git bloqueado para o agente.');
  }
}

function getSafePath(root, relativePath, { canCreate = false } = {}) {
  if (typeof relativePath !== 'string' || !relativePath.trim() || path.isAbsolute(relativePath)) {
    throw new Error('Informe um caminho relativo ao projeto.');
  }
  const normalized = path.normalize(relativePath);
  assertSafeFileName(normalized);
  const target = path.resolve(root, normalized);
  if (!isInside(root, target)) throw new Error('Caminho fora do projeto bloqueado.');

  // Confere cada componente existente: realpath resolve symlinks e junctions do Windows.
  let current = target;
  while (!fs.existsSync(current)) {
    if (!canCreate) throw new Error('Arquivo ou pasta inexistente.');
    const parent = path.dirname(current);
    if (parent === current) throw new Error('Caminho inválido.');
    current = parent;
  }
  const resolved = fs.realpathSync(current);
  if (!isInside(root, resolved)) throw new Error('Link ou junction aponta para fora do projeto.');
  return target;
}

function runProcess(exe, args, { cwd, signal, timeout = 30_000, maxChars = LIMIT, onOutput } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('Execução cancelada.'));
    const child = spawn(exe, args, { cwd, windowsHide: true, shell: false, env: process.env });
    let out = '';
    let truncated = false;
    let finished = false;
    let killedByTimeout = false;
    const keep = (value) => {
      onOutput?.(value);
      if (out.length >= maxChars) { truncated = true; return; }
      const room = maxChars - out.length;
      out += value.slice(0, room);
      if (value.length > room) truncated = true;
    };
    const stop = () => {
      if (finished || !child.pid) return;
      // Mata a arvore de processos, inclusive filhos criados pelo PowerShell.
      if (process.platform === 'win32') {
        const killer = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true });
        killer.on('error', () => child.kill());
      } else child.kill('SIGKILL');
    };
    const timer = timeout > 0 ? setTimeout(() => { killedByTimeout = true; stop(); }, timeout) : null;
    const aborted = () => stop();
    signal?.addEventListener('abort', aborted, { once: true });
    child.stdout.setEncoding('utf8').on('data', keep);
    child.stderr.setEncoding('utf8').on('data', keep);
    child.on('error', (error) => finish(error));
    child.on('close', (code) => finish(null, code));
    function finish(error, code) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', aborted);
      if (error) return reject(error);
      if (signal?.aborted) return reject(new Error('Execução cancelada.'));
      resolve({ exitCode: code, output: out + (truncated ? '\n[saída truncada]' : ''), timedOut: killedByTimeout });
    }
  });
}

class Workspace {
  constructor(directory) {
    if (typeof directory !== 'string' || !fs.statSync(directory).isDirectory()) throw new Error('Pasta inválida.');
    this.root = fs.realpathSync(directory);
    this.readHashes = new Map();
  }

  listFiles(relativePath = '.') {
    const dir = getSafePath(this.root, relativePath);
    if (!fs.statSync(dir).isDirectory()) throw new Error('O caminho não é uma pasta.');
    const output = [];
    const scan = (current, depth) => {
      if (output.length >= 160) return;
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        if (IGNORED_DIRS.has(entry.name) || PRIVATE_FILES.test(entry.name)) continue;
        const file = path.join(current, entry.name);
        if (entry.isSymbolicLink()) continue;
        const rel = path.relative(this.root, file).replaceAll('\\', '/');
        output.push(entry.isDirectory() ? `${rel}/` : rel);
        if (entry.isDirectory() && depth < 2) scan(file, depth + 1);
        if (output.length >= 160) break;
      }
    };
    scan(dir, 0);
    return { files: output, truncated: output.length >= 160 };
  }

  async listDirectory(relativePath = '.') {
    const dir = getSafePath(this.root, relativePath);
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    return entries.filter(entry => entry.name !== '.git').map(entry => ({
      name: entry.name,
      path: path.relative(this.root, path.join(dir, entry.name)).replaceAll('\\', '/'),
      directory: entry.isDirectory(),
      link: entry.isSymbolicLink(),
    })).sort((a, b) => Number(b.directory) - Number(a.directory) || a.name.localeCompare(b.name, 'pt-BR', { numeric: true, sensitivity: 'base' }));
  }

  async gitChanges() {
    const [result, location] = await Promise.all([
      runProcess('git', ['status', '--porcelain=v1', '-z', '--untracked-files=normal', '--', '.'], { cwd: this.root, maxChars: 200_000 }),
      runProcess('git', ['rev-parse', '--show-prefix'], { cwd: this.root }),
    ]);
    if (result.exitCode !== 0 || location.exitCode !== 0) return { changes: [], warning: 'Indicadores Git indisponíveis nesta pasta.' };
    const prefix = location.output.replace(/\r?\n$/, '');
    const records = result.output.split('\0');
    const changes = [];
    // O último registro pode estar incompleto se o limite de saída tiver sido atingido.
    for (let i = 0; i < records.length - 1; i++) {
      const record = records[i];
      const code = record.slice(0, 2);
      const name = record.slice(3);
      if (name.startsWith(prefix)) changes.push({ path: name.slice(prefix.length).replace(/\/$/, ''), status: code === '??' ? 'U' : code.includes('U') ? '!' : [...'DRMA'].find(value => code.includes(value)) || 'M' });
      if (/[RC]/.test(code)) i++; // Em -z, o caminho antigo vem depois do destino.
    }
    return { changes, warning: result.output.endsWith('[saída truncada]') ? 'Há mais alterações Git do que o limite de exibição.' : '' };
  }

  readFile(relativePath, { track = true } = {}) {
    const target = getSafePath(this.root, relativePath);
    const stats = fs.statSync(target);
    if (!stats.isFile()) throw new Error('O caminho não é um arquivo.');
    if (stats.size > 100_000) throw new Error('Arquivo grande demais para o contexto (100 KB).');
    const data = fs.readFileSync(target);
    if (data.includes(0)) throw new Error('Arquivo binário não suportado neste MVP.');
    if (track) this.readHashes.set(target, hash(data));
    return { path: path.relative(this.root, target).replaceAll('\\', '/'), content: data.toString('utf8') };
  }

  writeFile(relativePath, content) {
    if (typeof content !== 'string' || Buffer.byteLength(content, 'utf8') > 100_000) {
      throw new Error('Conteúdo inválido ou acima do limite de 100 KB.');
    }
    const target = getSafePath(this.root, relativePath, { canCreate: true });
    if (fs.existsSync(target)) {
      if (!fs.statSync(target).isFile()) throw new Error('O caminho não é um arquivo.');
      const expected = this.readHashes.get(target);
      if (!expected) throw new Error('Leia o arquivo antes de alterá-lo.');
      if (hash(fs.readFileSync(target)) !== expected) throw new Error('Arquivo modificado desde a leitura; releia antes de sobrescrever.');
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, { encoding: 'utf8', flag: 'w' });
    this.readHashes.set(target, hash(Buffer.from(content, 'utf8')));
    return { path: path.relative(this.root, target).replaceAll('\\', '/'), bytes: Buffer.byteLength(content) };
  }

  async command(command, signal, { timeout = 30_000, onOutput } = {}) {
    if (typeof command !== 'string' || !command.trim() || command.length > 4_000) {
      throw new Error('Comando inválido.');
    }
    // spawn recebe o script como um único argumento Unicode, sem um shell intermediário.
    // -Command evita a serialização CLIXML de stderr ativada por -EncodedCommand.
    const script = `[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)\n${command}`;
    return runProcess(process.platform === 'win32' ? 'powershell.exe' : 'pwsh',
      ['-NoLogo', '-NoProfile', '-NonInteractive', '-OutputFormat', 'Text', '-Command', script],
      { cwd: this.root, signal, timeout, onOutput });
  }

  async gitStatus(signal) {
    return runProcess('git', ['status', '--short', '--branch'], { cwd: this.root, signal });
  }

  async gitDiff(signal) {
    const [working, staged] = await Promise.all([
      runProcess('git', ['diff', '--no-ext-diff', '--no-textconv'], { cwd: this.root, signal }),
      runProcess('git', ['diff', '--cached', '--no-ext-diff', '--no-textconv'], { cwd: this.root, signal }),
    ]);
    return { working, staged };
  }
}

module.exports = { Workspace, runProcess, isInside };
