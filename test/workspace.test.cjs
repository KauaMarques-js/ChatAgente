const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Workspace, runProcess } = require('../src/workspace.cjs');

function project(t) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'chat agente á - '));
  t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  return new Workspace(folder);
}

test('lê e escreve arquivos Unicode em pastas com espaços', t => {
  const workspace = project(t);
  workspace.writeFile('pasta com espaço/olá.txt', 'Olá, mundo!');
  assert.equal(workspace.readFile('pasta com espaço/olá.txt').content, 'Olá, mundo!');
  assert.ok(workspace.listFiles().files.includes('pasta com espaço/olá.txt'));
});

test('bloqueia caminhos fora do projeto e arquivos privados', t => {
  const workspace = project(t);
  assert.throws(() => workspace.readFile('../fora.txt'), /fora do projeto/);
  assert.throws(() => workspace.writeFile('../fora.txt', 'perigo'), /fora do projeto/);
  assert.throws(() => workspace.writeFile('.env', 'token=segredo'), /sensível/);
  assert.throws(() => workspace.readFile('.git/config'), /interno do Git/);
});

test('exige leitura e detecta conflito antes de sobrescrever', t => {
  const workspace = project(t);
  const file = path.join(workspace.root, 'codigo.txt');
  fs.writeFileSync(file, 'versão original');
  assert.throws(() => workspace.writeFile('codigo.txt', 'sem leitura'), /Leia o arquivo/);
  workspace.readFile('codigo.txt');
  fs.writeFileSync(file, 'outra edição');
  assert.throws(() => workspace.writeFile('codigo.txt', 'substituir'), /modificado desde/);
  assert.equal(fs.readFileSync(file, 'utf8'), 'outra edição');
});

test('PowerShell executa comando real e devolve saída e código', { skip: process.platform !== 'win32' }, async t => {
  const workspace = project(t);
  const result = await workspace.command('Write-Output "ação é útil ✓"');
  assert.equal(result.exitCode, 0);
  assert.match(result.output, /ação é útil ✓/);
});

test('PowerShell mostra avisos e erros como texto legível, sem CLIXML', { skip: process.platform !== 'win32' }, async t => {
  const workspace = project(t);
  const result = await workspace.command('Write-Warning "AVISO_TESTE"; Write-Error "ERRO_TESTE"; exit 3');
  assert.equal(result.exitCode, 3);
  assert.match(result.output, /AVISO_TESTE/);
  assert.match(result.output, /ERRO_TESTE/);
  assert.doesNotMatch(result.output, /CLIXML|<Objs/);
});

test('não permite seguir junction para fora do projeto', { skip: process.platform !== 'win32' }, t => {
  const workspace = project(t);
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'fora-chatagente-'));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  fs.writeFileSync(path.join(outside, 'private.txt'), 'segredo');
  fs.symlinkSync(outside, path.join(workspace.root, 'atalho'), 'junction');
  assert.throws(() => workspace.readFile('atalho/private.txt'), /fora do projeto/);
  assert.throws(() => workspace.writeFile('atalho/novo.txt', 'x'), /fora do projeto/);
});

test('cancelamento impede execução de comando', async t => {
  const workspace = project(t);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(workspace.command('Write-Output teste', controller.signal), /cancelada/);
});

test('transmite Unicode sem quebrar bytes e continua após truncar o resultado', async () => {
  const chunks = [];
  const result = await runProcess(process.execPath, ['-e', `
    const bytes = Buffer.from('ação ✓');
    process.stdout.write(bytes.subarray(0, 2));
    setTimeout(() => { process.stdout.write(bytes.subarray(2)); process.stderr.write(' fim'); }, 50);
  `], { maxChars: 2, onOutput: text => chunks.push(text) });
  assert.equal(result.exitCode, 0);
  assert.match(chunks.join(''), /ação ✓/);
  assert.match(chunks.join(''), / fim/);
  assert.doesNotMatch(chunks.join(''), /�/);
  assert.match(result.output, /saída truncada/);
});

test('PowerShell transmite antes de terminar e permite interromper durante a execução', { skip: process.platform !== 'win32', timeout: 10_000 }, async t => {
  const workspace = project(t);
  const controller = new AbortController();
  t.after(() => controller.abort());
  const chunks = [];
  await assert.rejects(workspace.command('Write-Output "INICIO ✓"; Start-Sleep -Seconds 60; Write-Output "FIM"', controller.signal, {
    timeout: 0,
    onOutput: text => { chunks.push(text); if (chunks.join('').includes('INICIO ✓')) controller.abort(); },
  }), /cancelada/);
  assert.match(chunks.join(''), /INICIO ✓/);
  assert.doesNotMatch(chunks.join(''), /FIM/);
});

test('interrupção encerra também o processo filho no Windows', { skip: process.platform !== 'win32', timeout: 10_000 }, async t => {
  const controller = new AbortController();
  t.after(() => controller.abort());
  let output = '';
  let childPid;
  await assert.rejects(runProcess(process.execPath, ['-e', `
    const { spawn } = require('node:child_process');
    const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
    console.log(child.pid);
    setInterval(() => {}, 1000);
  `], { signal: controller.signal, onOutput: text => {
    output += text;
    if (output.includes('\n')) { childPid = Number(output.trim()); controller.abort(); }
  } }), /cancelada/);
  assert.ok(childPid > 0);
  assert.throws(() => process.kill(childPid, 0), { code: 'ESRCH' });
});

test('explorador lista apenas o nível pedido, ordena pastas e inclui dependências', async t => {
  const workspace = project(t);
  fs.mkdirSync(path.join(workspace.root, 'node_modules', 'pacote'), { recursive: true });
  fs.mkdirSync(path.join(workspace.root, '.git'));
  fs.mkdirSync(path.join(workspace.root, 'docs'));
  fs.writeFileSync(path.join(workspace.root, 'docs', 'ação.md'), 'Olá');
  fs.writeFileSync(path.join(workspace.root, '.env'), 'segredo');
  fs.writeFileSync(path.join(workspace.root, 'README.md'), 'Projeto');
  const entries = await workspace.listDirectory();
  assert.deepEqual(entries.map(entry => entry.name), ['docs', 'node_modules', '.env', 'README.md']);
  assert.equal(entries.some(entry => entry.path.includes('ação')), false);
  assert.equal((await workspace.listDirectory('docs'))[0].path, 'docs/ação.md');
  assert.equal((await workspace.listDirectory('node_modules'))[0].name, 'pacote');
  await assert.rejects(workspace.listDirectory('../'), /fora do projeto/);
  await assert.rejects(workspace.listDirectory('.git'), /interno do Git/);
});

test('prévia não autoriza escrita do agente e mantém bloqueio de segredos e binários', t => {
  const workspace = project(t);
  fs.writeFileSync(path.join(workspace.root, 'arquivo.md'), 'Prévia');
  fs.writeFileSync(path.join(workspace.root, '.env'), 'segredo');
  fs.writeFileSync(path.join(workspace.root, 'binario'), Buffer.from([1, 0, 2]));
  assert.equal(workspace.readFile('arquivo.md', { track: false }).content, 'Prévia');
  assert.throws(() => workspace.writeFile('arquivo.md', 'edição'), /Leia o arquivo/);
  assert.throws(() => workspace.readFile('.env', { track: false }), /sensível/);
  assert.throws(() => workspace.readFile('binario', { track: false }), /binário/);
});

test('explorador mantém links externos bloqueados', { skip: process.platform !== 'win32' }, async t => {
  const workspace = project(t);
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'explorer-outside-'));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  fs.symlinkSync(outside, path.join(workspace.root, 'externo'), 'junction');
  assert.equal((await workspace.listDirectory())[0].link, true);
  await assert.rejects(workspace.listDirectory('externo'), /fora do projeto/);
});

test('explorador usa Git real, com renomeação, Unicode e projeto dentro de repositório', async t => {
  const workspace = project(t);
  const git = async (...args) => {
    const result = await runProcess('git', args, { cwd: workspace.root });
    assert.equal(result.exitCode, 0, result.output);
  };
  await git('init');
  fs.mkdirSync(path.join(workspace.root, 'sub'));
  fs.writeFileSync(path.join(workspace.root, 'sub', 'antigo.md'), 'original');
  fs.writeFileSync(path.join(workspace.root, 'sub', 'ação com espaço.md'), 'original');
  await git('add', '.');
  await git('-c', 'user.name=Teste', '-c', 'user.email=test@example.test', '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=.sem-hooks', 'commit', '-m', 'base');
  await git('mv', 'sub/antigo.md', 'sub/novo.md');
  fs.writeFileSync(path.join(workspace.root, 'sub', 'ação com espaço.md'), 'alterado');
  fs.writeFileSync(path.join(workspace.root, 'sub', 'novo.txt'), 'novo');
  fs.writeFileSync(path.join(workspace.root, 'fora.txt'), 'fora da subpasta');
  const sub = new Workspace(path.join(workspace.root, 'sub'));
  const result = await sub.gitChanges();
  assert.deepEqual(result.changes.sort((a, b) => a.path.localeCompare(b.path)), [
    { path: 'ação com espaço.md', status: 'M' },
    { path: 'novo.md', status: 'R' },
    { path: 'novo.txt', status: 'U' },
  ]);
});
