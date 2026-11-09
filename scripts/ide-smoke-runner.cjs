exports.run = async function () {
  const vscode = require('vscode');
  const assert = require('node:assert/strict');
  const fs = require('node:fs');
  const path = require('node:path');
  const root = process.env.CHATAGENTE_TEST_FIXTURE;
  const report = process.env.CHATAGENTE_TEST_REPORT;
  const wait = async condition => {
    const deadline = Date.now() + 12000;
    while (!await condition()) {
      if (Date.now() > deadline) throw new Error('Tempo de espera do teste da IDE esgotado.');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  };
  const extension = vscode.extensions.getExtension('chatagente.chatagente');
  assert.ok(extension, 'Integração ChatAgente distribuída com a IDE');
  const api = await extension.activate();
  const commands = await vscode.commands.getCommands(true);
  for (const command of ['chatagente.open', 'chatagente.selectAgent', 'workbench.action.terminal.toggleTerminal', 'workbench.view.scm']) assert.ok(commands.includes(command), command);
  await vscode.commands.executeCommand('chatagente.selectAgent', 'codex');
  assert.equal(api.getState().backend, 'codex');
  await vscode.commands.executeCommand('chatagente.selectAgent', 'chatgpt');
  assert.equal(api.getState().backend, 'chatgpt');
  assert.equal(api.getState().busy, false);
  const file = path.join(root, 'codigo.js');
  const document = await vscode.workspace.openTextDocument(vscode.Uri.file(file));
  await vscode.window.showTextDocument(document);
  const edit = new vscode.WorkspaceEdit();
  edit.insert(document.uri, new vscode.Position(0, 0), '// edição na IDE ✓\n');
  assert.equal(await vscode.workspace.applyEdit(edit), true);
  assert.equal(await document.save(), true);
  assert.match(fs.readFileSync(file, 'utf8'), /edição na IDE ✓/);
  const { Workspace } = require(path.join(extension.extensionPath, 'runtime', 'workspace.cjs'));
  const { guardWorkspace } = require(path.join(extension.extensionPath, 'security.cjs'));
  const EditorWorkspace = guardWorkspace(Workspace, () => vscode.workspace.textDocuments);
  const workspace = new EditorWorkspace(root);
  workspace.readFile('codigo.js');
  const dirty = new vscode.WorkspaceEdit();
  dirty.insert(document.uri, new vscode.Position(0, 0), '// não salvo\n');
  await vscode.workspace.applyEdit(dirty);
  assert.throws(() => workspace.writeFile('codigo.js', 'não sobrescrever'), /não salva/);
  await document.save();
  const terminal = vscode.window.createTerminal({ name: 'Validação ChatAgente', shellPath: 'powershell.exe', shellArgs: ['-NoLogo', '-NoProfile'], cwd: root });
  const quote = value => `'${value.replaceAll("'", "''")}'`;
  const marker = path.join(root, 'terminal-persistente.txt');
  try {
    terminal.show();
    terminal.sendText("$env:CHATAGENTE_SESSION='persistente'");
    terminal.sendText(`[System.IO.File]::WriteAllText(${quote(marker)}, $env:CHATAGENTE_SESSION + '|' + (Get-Location).Path)`);
    await wait(() => fs.existsSync(marker));
    const [session, location] = fs.readFileSync(marker, 'utf8').split('|');
    assert.equal(session, 'persistente');
    assert.equal(fs.statSync(location).ino, fs.statSync(root).ino);
    assert.equal(fs.statSync(location).dev, fs.statSync(root).dev);
    terminal.sendText(`Start-Sleep -Seconds 60; [System.IO.File]::WriteAllText(${quote(path.join(root, 'nao-deve-existir.txt'))}, 'falha')`);
    await new Promise(resolve => setTimeout(resolve, 500));
    terminal.sendText('\u0003', false);
    await new Promise(resolve => setTimeout(resolve, 300));
    terminal.sendText(`[System.IO.File]::WriteAllText(${quote(path.join(root, 'apos-ctrl-c.txt'))}, 'ok')`);
    await wait(() => fs.existsSync(path.join(root, 'apos-ctrl-c.txt')));
    assert.equal(fs.existsSync(path.join(root, 'nao-deve-existir.txt')), false);
    const git = vscode.extensions.getExtension('vscode.git');
    assert.ok(git);
    await git.activate();
    await wait(() => git.exports.getAPI(1).repositories.length > 0);
    await vscode.commands.executeCommand('chatagente.open');
    assert.equal(api.getState().chatLocation, 'editor');
    const { ChatView } = require(path.join(extension.extensionPath, 'extension.cjs'));
    const { Agent } = require(path.join(extension.extensionPath, 'runtime', 'agent.cjs'));
    const chat = new ChatView({ extensionPath: extension.extensionPath, extensionUri: extension.extensionUri, subscriptions: [] },
      { Workspace, Agent }, { status: () => ({ connected: true, sharing: true }) });
    chat.model = 'modelo-simulado-teste';
    chat.workspace = new Workspace(vscode.workspace.workspaceFolders[0].uri.fsPath);
    chat.agents.chatgpt = new Agent({ workspace: chat.workspace, onEvent: event => chat.entry(event), client: { responses: { create: async () => (async function* () {
      yield { type: 'response.completed', response: { status: 'completed', output: [],
        output_text: 'Claro! Para uma tarefa simples, podemos conversar diretamente.\n\n## Exemplo\n\n```js\nconsole.log("Olá, mundo!");\n```\n\nSe quiser criar um projeto completo, posso trabalhar nos arquivos da pasta aberta.',
        usage: { input_tokens: 120, output_tokens: 40, total_tokens: 160, input_tokens_details: { cached_tokens: 80 }, output_tokens_details: { reasoning_tokens: 10 } } } };
    })() } } });
    chat.openChat();
    await chat.send('Pode me ajudar com uma tarefa simples?');
    assert.equal(chat.getState().usage.turn.totalTokens, 160);
    assert.equal(chat.getState().usage.turn.cachedInputTokens, 80);
    await new Promise(resolve => setTimeout(resolve, 800));
    await fs.promises.writeFile(`${report}.screenshot-ready`, 'ready');
    await wait(() => fs.existsSync(`${report}.screenshot-done`));
    fs.writeFileSync(report, JSON.stringify({ passed: true, app: vscode.env.appName, vscodeVersion: vscode.version,
      checks: ['builtin extension', 'ChatGPT/Codex selection', 'native editor/save', 'unsaved buffer protected', 'PowerShell persistent state', 'Ctrl+C', 'native Git', 'central chat panel', 'token usage from simulated service metadata'],
    }, null, 2));
    chat.dispose();
  } finally { terminal.dispose(); }
};
