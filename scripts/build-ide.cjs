const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const root = path.resolve(__dirname, '..');
const base = require('../ide-base.json');
const manifest = require('../package.json');
const destination = path.join(root, 'out', 'ide-app');
const cache = path.join(root, 'out', 'base-cache');
function run(executable, args, cwd = root) {
  const result = spawnSync(executable, args, { cwd, stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Falha no empacotamento (código ${result.status}).`);
}
async function sha256(file) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
async function main() {
  if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('A distribuição atual exige Windows x64.');
  await fsp.mkdir(cache, { recursive: true });
  const archive = path.join(cache, `VSCodium-${base.version}-x64.zip`);
  if (!fs.existsSync(archive) || await sha256(archive) !== base.sha256) {
    console.log(`Baixando base Code OSS/VSCodium ${base.version}...`);
    const response = await fetch(base.url);
    if (!response.ok || !response.body) throw new Error(`Download da base: HTTP ${response.status}`);
    await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(`${archive}.part`));
    if (await sha256(`${archive}.part`) !== base.sha256) throw new Error('SHA-256 da base não confere.');
    await fsp.rename(`${archive}.part`, archive);
  }
  const stamp = path.join(destination, 'chatagente-base.json');
  if (!fs.existsSync(stamp) || JSON.parse(fs.readFileSync(stamp, 'utf8')).version !== base.version) {
    // Somente esta saída gerada pode ser substituída; nunca projetos ou dados do usuário.
    if (path.dirname(destination) !== path.join(root, 'out') || path.basename(destination) !== 'ide-app') throw new Error('Destino inválido.');
    if (fs.existsSync(destination)) await fsp.rm(destination, { recursive: true, force: true });
    await fsp.mkdir(destination, { recursive: true });
    console.log('Extraindo a base verificada...');
    run(path.join(root, 'node_modules', 'electron-winstaller', 'vendor', '7z.exe'), ['x', archive, `-o${destination}`, '-y', '-bso0', '-bsp0']);
    await fsp.rename(path.join(destination, 'VSCodium.exe'), path.join(destination, 'ChatAgente.exe'));
    await fsp.writeFile(stamp, JSON.stringify(base, null, 2));
  }
  const app = path.join(destination, 'resources', 'app');
  const productPath = path.join(app, 'product.json');
  const product = JSON.parse(await fsp.readFile(productPath, 'utf8'));
  Object.assign(product, {
    nameShort: 'ChatAgente', nameLong: 'ChatAgente', applicationName: 'chatagente',
    dataFolderName: '.chatagente-ide', urlProtocol: 'chatagente',
    sharedDataFolderName: '.chatagente-shared',
    win32MutexName: 'chatagente-ide', win32DirName: 'ChatAgente', win32NameVersion: 'ChatAgente',
    win32RegValueName: 'ChatAgente', win32AppUserModelId: 'KauaMarques.ChatAgente.IDE',
    reportIssueUrl: 'https://github.com/KauaMarques-js/ChatAgente/issues',
  });
  delete product.updateUrl;
  delete product.downloadUrl;
  await fsp.writeFile(productPath, JSON.stringify(product, null, 2));
  const launcher = path.join(destination, 'bin', 'codium.cmd');
  if (fs.existsSync(launcher)) {
    const cmd = (await fsp.readFile(launcher, 'utf8')).replaceAll('VSCodium.exe', 'ChatAgente.exe');
    await fsp.writeFile(launcher, cmd);
    await fsp.writeFile(path.join(destination, 'bin', 'chatagente.cmd'), cmd);
  }
  const extensionRoot = path.join(destination, 'resources', 'app', 'extensions', 'chatagente');
  await fsp.mkdir(extensionRoot, { recursive: true });
  await fsp.cp(path.join(root, 'ide-extension'), extensionRoot, {
    recursive: true,
    filter: file => !['node_modules', 'runtime', 'test', 'tests'].includes(path.basename(file)),
  });
  const extensionManifestPath = path.join(extensionRoot, 'package.json');
  const extensionManifest = JSON.parse(await fsp.readFile(extensionManifestPath, 'utf8'));
  extensionManifest.version = manifest.version;
  await fsp.writeFile(extensionManifestPath, JSON.stringify(extensionManifest, null, 2));
  await fsp.mkdir(path.join(extensionRoot, 'runtime'), { recursive: true });
  for (const name of ['agent.cjs', 'workspace.cjs', 'codex-agent.cjs', 'chatgpt-auth.cjs', 'usage.cjs']) {
    await fsp.copyFile(path.join(root, 'src', name), path.join(extensionRoot, 'runtime', name));
  }
  const npmCli = process.env.npm_execpath || path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
  const dependencies = spawnSync(process.execPath, [npmCli, 'ls', '--omit=dev', '--all', '--parseable'], { cwd: root, encoding: 'utf8', windowsHide: true });
  if (dependencies.status !== 0) throw new Error('Não foi possível resolver as dependências de produção. Execute npm install.');
  for (const folder of dependencies.stdout.trim().split(/\r?\n/)) {
    if (folder === root) continue;
    if (/^codex-(?:darwin-|linux-|win32-arm64)/.test(path.basename(folder))) continue;
    const relative = path.relative(path.join(root, 'node_modules'), folder);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Dependência fora de node_modules.');
    await fsp.cp(folder, path.join(extensionRoot, 'node_modules', relative), { recursive: true });
  }
  for (const name of ['LICENSE', 'README.md']) await fsp.copyFile(path.join(root, name), path.join(extensionRoot, name));
  await fsp.writeFile(path.join(destination, 'CHATAGENTE-NOTICE.txt'), [
    `ChatAgente ${manifest.version} — https://github.com/KauaMarques-js/ChatAgente`,
    `Base: Code OSS / VSCodium ${base.version} (MIT). ${base.source}`,
    'Distribuição independente; não é Microsoft Visual Studio Code nem produto oficial da OpenAI.',
    'As licenças, avisos de terceiros e a loja Open VSX da base foram preservados.',
    'Agentes: ChatGPT próprio por OAuth oficial e Codex SDK/CLI oficial. Limites da conta/provedor continuam aplicáveis.',
  ].join('\r\n'));
  console.log(`IDE preparada: ${path.join(destination, 'ChatAgente.exe')}`);
  if (!process.argv.includes('--prepare')) {
    // O cache do empacotador não detecta mudanças internas da base --prepackaged.
    // Recria apenas os artefatos gerados desta versão, inclusive após build interrompido.
    const output = path.join(root, 'dist');
    for (const name of [`ChatAgente-${manifest.version}-win.zip`, `ChatAgente-Setup-${manifest.version}-x64.exe`,
      `ChatAgente-Setup-${manifest.version}-x64.exe.blockmap`, `chatagente-${manifest.version}-x64.nsis.7z`]) {
      const target = path.resolve(output, name);
      if (path.dirname(target) !== output) throw new Error('Artefato de saída inválido.');
      await fsp.rm(target, { force: true });
    }
    run(process.execPath, [path.join(root, 'node_modules', 'electron-builder', 'cli.js'), '--prepackaged', destination, '--win', 'nsis', 'zip', '--x64', '--publish', 'never']);
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
