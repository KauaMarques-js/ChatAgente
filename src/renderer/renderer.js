const api = window.chatAgente;
const $ = id => document.getElementById(id);
let busy = false;
let reply;

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
  $('terminal-input').disabled = isBusy;
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
  el.textContent = `${el.textContent}\n${output}`.slice(-25_000);
  scrollEnd(el);
}
function setInfo(info) {
  $('project-path').textContent = info.directory;
  $('model-name').textContent = info.model;
  $('api-state').textContent = info.apiConfigured ? 'API configurada' : 'API sem chave (.env)';
  $('api-dot').classList.toggle('good', info.apiConfigured);
}

api.onEvent(event => {
  if (event.type === 'delta') {
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
  } finally { reply = null; $('prompt').focus(); }
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
  appendTerminal(`PS> ${command}`);
  setBusy(true, 'PowerShell...');
  try {
    const result = await api.terminal(command);
    appendTerminal(`${result.output}\n[código ${result.exitCode}${result.timedOut ? ', tempo esgotado' : ''}]`);
  } catch (error) { appendTerminal(`Erro: ${error.message}`); }
  finally { setBusy(false); $('terminal-input').focus(); }
});

api.info().then(setInfo).catch(showError);
