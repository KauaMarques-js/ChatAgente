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

function runProcess(exe, args, { cwd, signal, timeout = 30_000, maxChars = LIMIT } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('Execução cancelada.'));
    const child = spawn(exe, args, { cwd, windowsHide: true, shell: false, env: process.env });
    let out = '';
    let truncated = false;
    let finished = false;
    let killedByTimeout = false;
    const keep = (value) => {
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
    const timer = setTimeout(() => { killedByTimeout = true; stop(); }, timeout);
    const aborted = () => stop();
    signal?.addEventListener('abort', aborted, { once: true });
    child.stdout.on('data', (data) => keep(data.toString('utf8')));
    child.stderr.on('data', (data) => keep(data.toString('utf8')));
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

  readFile(relativePath) {
    const target = getSafePath(this.root, relativePath);
    const stats = fs.statSync(target);
    if (!stats.isFile()) throw new Error('O caminho não é um arquivo.');
    if (stats.size > 100_000) throw new Error('Arquivo grande demais para o contexto (100 KB).');
    const data = fs.readFileSync(target);
    if (data.includes(0)) throw new Error('Arquivo binário não suportado neste MVP.');
    this.readHashes.set(target, hash(data));
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

  async command(command, signal) {
    if (typeof command !== 'string' || !command.trim() || command.length > 4_000) {
      throw new Error('Comando inválido.');
    }
    // EncodedCommand suporta acentos e evita quebrar os argumentos do spawn.
    const script = `[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)\n${command}`;
    const encoded = Buffer.from(script, 'utf16le').toString('base64');
    return runProcess(process.platform === 'win32' ? 'powershell.exe' : 'pwsh',
      ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', encoded],
      { cwd: this.root, signal });
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
