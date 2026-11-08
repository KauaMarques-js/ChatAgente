(() => {
  const vscode = acquireVsCodeApi();
  const $ = id => document.getElementById(id);
  const send = (command, value) => vscode.postMessage(value === undefined ? { command } : { command, value });
  let assistant = null;
  let busy = false;
  let selectedBackend = 'chatgpt';
  function article(title, text, kind) {
    const node = document.createElement('article');
    if (kind) node.className = kind;
    const heading = document.createElement('strong'); heading.textContent = title;
    const content = document.createElement('p'); content.textContent = text || '';
    node.append(heading, content); $('messages').append(node); return content;
  }
  function event(e) {
    if (e.type === 'user') { assistant = null; article('Você', e.text); }
    else if (e.type === 'start') assistant = article(selectedBackend === 'codex' ? 'Codex' : 'ChatGPT', '');
    else if (e.type === 'delta') { if (!assistant) assistant = article('Agente', ''); assistant.textContent += e.text || ''; }
    else if (e.type === 'done') { if (!assistant) assistant = article('Agente', ''); assistant.textContent = e.text || assistant.textContent; assistant = null; }
    else if (e.type === 'error') { article('Aviso', e.text, 'error'); assistant = null; }
    else if (e.type === 'action') {
      const details = document.createElement('details'); const summary = document.createElement('summary'); const pre = document.createElement('pre');
      summary.textContent = `${e.name || 'Ação'} · ${e.status || ''}`; pre.textContent = typeof e.output === 'string' ? e.output : JSON.stringify(e.output ?? '');
      details.append(summary, pre); $('messages').append(details);
    } else if (e.type === 'status') $('status').textContent = e.text || e.status || 'Executando…';
  }
  document.querySelectorAll('[data-command]').forEach(button => button.addEventListener('click', () => send(button.dataset.command)));
  $('backend').addEventListener('change', () => send('backend', $('backend').value));
  $('model').addEventListener('change', () => send('model', $('model').value));
  $('apply-model').addEventListener('click', () => send('model', $('codex-model').value.trim()));
  $('composer').addEventListener('submit', e => { e.preventDefault(); if (!busy && $('prompt').value.trim()) { send('send', $('prompt').value); $('prompt').value = ''; } });
  $('prompt').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('composer').requestSubmit(); } });
  window.addEventListener('message', ({ data }) => {
    if (data.type === 'clear') { $('messages').replaceChildren(); assistant = null; }
    if (data.type === 'history') { $('messages').replaceChildren(); assistant = null; data.entries.forEach(event); }
    if (data.type === 'event') event(data.event);
    if (data.type === 'state') {
      busy = data.busy; selectedBackend = data.backend;
      const codex = data.backend === 'codex'; $('backend').value = data.backend;
      $('directory').textContent = data.directory || 'Abra uma pasta para começar.';
      $('model').hidden = codex; document.querySelector('label[for="model"]').hidden = codex;
      for (const id of ['codex-label', 'codex-model', 'apply-model']) $(id).hidden = !codex;
      $('models').hidden = codex; $('login').textContent = codex ? 'Entrar com Codex' : 'Entrar com ChatGPT';
      $('connection').textContent = codex ? 'Login e logout no terminal nativo. Usa o perfil local do Codex.' : (data.connected ? 'ChatGPT conectado' : 'ChatGPT desconectado');
      $('model').replaceChildren();
      for (const model of data.models) { const option = document.createElement('option'); option.value = model.slug; option.textContent = model.name; $('model').append(option); }
      if (!data.models.length) { const option = document.createElement('option'); option.textContent = 'Entre para carregar modelos'; option.value = ''; $('model').append(option); }
      if (codex) $('codex-model').value = data.model; else $('model').value = data.model;
      document.querySelectorAll('button,select,input').forEach(control => { control.disabled = busy; });
      $('stop').disabled = !busy; $('status').textContent = busy ? 'Executando…' : 'Pronto';
    }
  });
  send('ready');
})();
