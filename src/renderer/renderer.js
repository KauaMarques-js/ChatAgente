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
  el.textContent = `${el.textContent}\n${output}`.slice(-25_000);
  scrollEnd(el);
}
function setInfo(info) {
  $('project-path').textContent = info.directory;
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

api.info().then(async info => { setInfo(info); await refreshModels(info); }).catch(showError);
