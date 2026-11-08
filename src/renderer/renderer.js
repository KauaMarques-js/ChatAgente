const api = window.chatAgente;
const $ = id => document.getElementById(id);
let busy = false;
let reply;
let terminalBusy = false;
let terminalStopping = false;
const terminalHistory = [];
let historyIndex = 0;
let terminalDraft = '';
let previousFocus;

function scrollEnd(element) { element.scrollTop = element.scrollHeight; }
function bubble(text, type = '') {
  const container = $('messages');
  container.querySelector('.welcome')?.remove();
  const el = document.createElement('div');
  el.className = `bubble ${type}`.trim();
  el.textContent = text;
  container.append(el);
  scrollEnd(container);
  return el;
}
function setBusy(isBusy, label = 'Pronto') {
  busy = isBusy;
  $('send').disabled = isBusy;
  $('stop').disabled = !isBusy;
  $('terminal-input').disabled = isBusy && !terminalBusy;
  $('terminal-input').readOnly = terminalBusy;
  $('terminal-run').disabled = isBusy;
  $('terminal-stop').disabled = !terminalBusy || terminalStopping;
  $('backend-select').disabled = isBusy;
  $('model-select').disabled = isBusy;
  $('sign-in').disabled = isBusy;
  $('disconnect').disabled = isBusy;
  $('task-status').textContent = label;
}
function showError(error) {
  const msg = error?.message || String(error);
  bubble(`Erro: ${msg}`, 'error');
  $('task-status').textContent = 'Erro';
}
function activity(name, details = '', status = '') {
  const container = $('activity');
  if (container.children.length === 1 && container.children[0].tagName === 'P') container.replaceChildren();
  const node = document.createElement('div');
  node.className = 'activity-item';
  const title = document.createElement('strong');
  title.textContent = `${name}${status ? ` · ${status}` : ''}`;
  node.append(title);
  if (details) {
    const pre = document.createElement('pre');
    pre.textContent = details;
    node.append(pre);
  }
  container.append(node);
  scrollEnd(container);
}
function appendTerminal(output) {
  const el = $('terminal-output');
  el.textContent = `${el.textContent}${output}`.slice(-25_000);
  scrollEnd(el);
}
function toggleTerminal() {
  const terminal = $('terminal');
  terminal.hidden = !terminal.hidden;
  document.querySelector('.layout').classList.toggle('terminal-hidden', terminal.hidden);
  $('toggle-terminal').setAttribute('aria-expanded', String(!terminal.hidden));
  if (terminal.hidden) {
    if (terminal.contains(document.activeElement)) {
      const target = previousFocus?.isConnected && !previousFocus.disabled ? previousFocus : $('prompt');
      target.focus();
    }
  } else {
    previousFocus = document.activeElement;
    (busy && !terminalBusy ? $('terminal-output') : $('terminal-input')).focus();
    scrollEnd($('terminal-output'));
  }
}
async function interruptTerminal() {
  if (!terminalBusy || terminalStopping) return;
  terminalStopping = true;
  $('terminal-stop').disabled = true;
  $('terminal-status').textContent = 'Interrompendo...';
  try { await api.stopTerminal(); }
  catch (error) {
    terminalStopping = false;
    $('terminal-stop').disabled = !terminalBusy;
    appendTerminal(`\nErro ao interromper: ${error.message}\n`);
  }
}

$('toggle-terminal').addEventListener('click', toggleTerminal);
$('terminal-close').addEventListener('click', toggleTerminal);
$('terminal-stop').addEventListener('click', interruptTerminal);
$('terminal-clear').addEventListener('click', () => { $('terminal-output').textContent = ''; });
document.addEventListener('keydown', event => {
  if (event.isComposing || event.repeat || !event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
  if (event.key === "'") {
    event.preventDefault();
    toggleTerminal();
  } else if (event.key.toLowerCase() === 'c' && terminalBusy && $('terminal').contains(document.activeElement)) {
    const input = $('terminal-input');
    const selectedInput = document.activeElement === input && input.selectionStart !== input.selectionEnd;
    if (selectedInput || window.getSelection()?.toString()) return;
    event.preventDefault();
    void interruptTerminal();
  }
});
$('terminal-input').addEventListener('keydown', event => {
  if (busy || event.isComposing || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
  event.preventDefault();
  if (historyIndex === terminalHistory.length) terminalDraft = event.target.value;
  historyIndex = Math.max(0, Math.min(terminalHistory.length, historyIndex + (event.key === 'ArrowUp' ? -1 : 1)));
  event.target.value = terminalHistory[historyIndex] ?? terminalDraft;
});
function setInfo(info) {
  $('project-path').textContent = info.directory;
  $('project-path').title = info.directory;
  window.projectExplorer.setProject(info.directory);
  $('backend-select').value = info.backend;
  $('chatgpt-settings').hidden = info.backend !== 'chatgpt';
  $('codex-settings').hidden = info.backend !== 'codex';
  $('disconnect').hidden = !info.chatgpt?.connected;
  $('sign-in').textContent = info.chatgpt?.connected ? 'Reconectar ChatGPT' : 'Continuar com ChatGPT';
  const connected = info.chatgpt?.sharing;
  $('api-state').textContent = info.backend === 'codex' ? 'Codex · via CLI' : connected
    ? `ChatGPT · ${info.chatgpt.email || 'plano conectado'}`
    : 'ChatGPT · login necessário';
  $('api-dot').classList.toggle('good', info.backend === 'codex' || connected);
  $('auth-description').textContent = info.authError || (connected
    ? 'Plano ChatGPT autorizado nesta IDE. O uso segue os limites da sua conta.'
    : info.chatgpt?.connected ? 'Conta conectada, mas o uso do plano não foi autorizado. Reconecte para autorizar.'
      : 'Continue com ChatGPT sem API key. Disponibilidade e limites dependem da sua conta.');
  if (!$('model-select').options.length) $('model-select').add(new Option(info.model, info.model));
  if ([...$('model-select').options].some(option => option.value === info.model)) $('model-select').value = info.model;
}

async function refreshModels(current) {
  if (!current || current.backend !== 'chatgpt') return;
  try {
    const models = await api.models();
    const select = $('model-select');
    select.replaceChildren();
    for (const model of models) select.add(new Option(model.name, model.slug));
    if (models.some(m => m.slug === current.model)) select.value = current.model;
    else if (models.length) {
      const updated = await api.setModel(models[0].slug);
      setInfo(updated);
    }
  } catch (error) { activity('Modelos ChatGPT', error.message, 'erro'); }
}

$('backend-select').addEventListener('change', async event => {
  try {
    const info = await api.selectBackend(event.target.value);
    setInfo(info);
    $('messages').replaceChildren();
    reply = null;
    activity('Agente selecionado', info.backend === 'chatgpt' ? 'ChatGPT' : 'Codex');
    await refreshModels(info);
  } catch (error) { showError(error); setInfo(await api.info()); }
});

$('model-select').addEventListener('change', async event => {
  try { const info = await api.setModel(event.target.value); setInfo(info); $('messages').replaceChildren(); reply = null; }
  catch (error) { showError(error); }
});

$('sign-in').addEventListener('click', async () => {
  setBusy(true, 'Autenticando no navegador...');
  try { const info = await api.signIn(); setInfo(info); await refreshModels(info); activity('ChatGPT conectado', info.chatgpt.email || '', info.chatgpt.sharing ? 'plano autorizado' : 'sem permissão de uso'); }
  catch (error) { showError(error); setInfo(await api.info()); }
  finally { setBusy(false); }
});

$('disconnect').addEventListener('click', async () => {
  try { const info = await api.disconnect(); if (info.warning) activity('Desconexão', info.warning, 'aviso'); setInfo(info); await refreshModels(info); $('messages').replaceChildren(); reply = null; activity('ChatGPT desconectado', 'Gerencie a autorização remota nas configurações do ChatGPT.'); }
  catch (error) { showError(error); }
});

$('usage').addEventListener('click', async () => {
  try { await api.openUsage(); } catch (error) { showError(error); }
});

api.onEvent(event => {
  if (event.type === 'terminal-output') {
    appendTerminal(event.text);
  } else if (event.type === 'delta') {
    if (!reply) reply = bubble('');
    reply.textContent += event.text;
    scrollEnd($('messages'));
  } else if (event.type === 'action') {
    // Nova resposta do modelo começa depois da ação.
    reply = null;
    const detail = event.args ? JSON.stringify(event.args, null, 2) : event.output;
    activity(event.name, detail || '', event.status);
  } else if (event.type === 'project') {
    activity('Projeto selecionado', event.directory);
  }
});

$('composer').addEventListener('submit', async event => {
  event.preventDefault();
  const prompt = $('prompt').value.trim();
  if (!prompt || busy) return;
  window.projectExplorer.closePreview();
  $('prompt').value = '';
  bubble(prompt, 'user');
  reply = null;
  setBusy(true, 'Executando...');
  try {
    const result = await api.send(prompt);
    if (!reply) bubble(result);
    setBusy(false, 'Concluído');
  } catch (error) {
    showError(error);
    setBusy(false, 'Falhou');
  } finally { reply = null; $('prompt').focus(); void window.projectExplorer.refresh(); }
});

$('prompt').addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    $('composer').requestSubmit();
  }
});

$('stop').addEventListener('click', async () => { await api.stop(); $('task-status').textContent = 'Interrompendo...'; });
$('choose-project').addEventListener('click', async () => {
  try { setInfo(await api.chooseProject()); } catch (error) { showError(error); }
});
$('reset-chat').addEventListener('click', async () => {
  try {
    await api.reset();
    $('messages').replaceChildren();
    activity('Conversa reiniciada');
  } catch (error) { showError(error); }
});
$('clear-log').addEventListener('click', () => $('activity').replaceChildren());
$('git-status').addEventListener('click', async () => {
  try { const result = await api.gitStatus(); activity('git status', result.output || '(sem alterações)', `código ${result.exitCode}`); }
  catch (error) { showError(error); }
});
$('git-diff').addEventListener('click', async () => {
  try { const result = await api.gitDiff(); activity('git diff', `WORKTREE:\n${result.working.output}\nSTAGED:\n${result.staged.output}`, `código ${result.working.exitCode}/${result.staged.exitCode}`); }
  catch (error) { showError(error); }
});
$('terminal-form').addEventListener('submit', async event => {
  event.preventDefault();
  const command = $('terminal-input').value.trim();
  if (!command || busy) return;
  $('terminal-input').value = '';
  if (terminalHistory.at(-1) !== command) terminalHistory.push(command);
  if (terminalHistory.length > 100) terminalHistory.shift();
  historyIndex = terminalHistory.length;
  terminalDraft = '';
  appendTerminal(`\nPS> ${command}\n`);
  terminalBusy = true;
  terminalStopping = false;
  $('terminal-status').textContent = 'Executando...';
  setBusy(true, 'PowerShell...');
  try {
    const result = await api.terminal(command);
    appendTerminal(`\n[código ${result.exitCode}${result.timedOut ? ', tempo esgotado' : ''}]\n`);
  } catch (error) { appendTerminal(`\n${terminalStopping ? 'Execução interrompida.' : `Erro: ${error.message}`}\n`); }
  finally {
    terminalBusy = false;
    terminalStopping = false;
    $('terminal-status').textContent = 'Pronto';
    setBusy(false);
    void window.projectExplorer.refresh();
    if (!$('terminal').hidden && $('terminal').contains(document.activeElement)) $('terminal-input').focus();
  }
});

api.info().then(async info => { setInfo(info); await refreshModels(info); }).catch(showError);
