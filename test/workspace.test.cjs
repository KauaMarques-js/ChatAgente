const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Workspace } = require('../src/workspace.cjs');

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
