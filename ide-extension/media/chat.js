(() => {
  'use strict';
  const vscode = acquireVsCodeApi();
  const $ = id => document.getElementById(id);
  const send = (command, value) => vscode.postMessage(value === undefined ? { command } : { command, value });
  let assistant = null;
  let busy = false;
  let selectedBackend = 'chatgpt';
  let statusText = 'Pronto';
  const viewport = $('conversation');
  const number = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value.toLocaleString('pt-BR') : 'Não informado';
  function follow(change) {
    const nearEnd = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 100;
    change();
    $('empty-state').hidden = $('messages').childElementCount > 0;
    if (nearEnd) viewport.scrollTop = viewport.scrollHeight;
  }
  function inline(parent, text) {
    // Only explicit http(s) links become anchors. Everything else remains literal text.
    const pattern = /(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*|\[[^\]\n]+\]\([^\s)]+\))/g;
    let offset = 0;
    for (const match of text.matchAll(pattern)) {
      parent.append(document.createTextNode(text.slice(offset, match.index)));
      const token = match[0];
      let node;
      if (token.startsWith('`')) { node = document.createElement('code'); node.textContent = token.slice(1, -1); }
      else if (token.startsWith('**')) { node = document.createElement('strong'); node.textContent = token.slice(2, -2); }
      else if (token.startsWith('*')) { node = document.createElement('em'); node.textContent = token.slice(1, -1); }
      else {
        const parts = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
        try {
          const url = new URL(parts[2]);
          if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Unsafe link');
          node = document.createElement('a'); node.href = url.href; node.rel = 'noopener noreferrer'; node.target = '_blank'; node.textContent = parts[1];
        } catch { node = document.createTextNode(token); }
      }
      parent.append(node); offset = match.index + token.length;
    }
    parent.append(document.createTextNode(text.slice(offset)));
  }
  function codeBlock(parent, language, text) {
    const block = document.createElement('div'); block.className = 'code-block';
    const toolbar = document.createElement('div'); toolbar.className = 'code-toolbar';
    const label = document.createElement('span'); label.textContent = language || 'Código';
    const copy = document.createElement('button'); copy.type = 'button'; copy.textContent = 'Copiar'; copy.setAttribute('aria-label', 'Copiar bloco de código');
    const pre = document.createElement('pre'); const code = document.createElement('code'); code.textContent = text; pre.append(code);
    copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(text); copy.textContent = 'Copiado'; }
      catch { copy.textContent = 'Selecione para copiar'; const selection = window.getSelection(); const range = document.createRange(); range.selectNodeContents(code); selection.removeAllRanges(); selection.addRange(range); }
    });
    toolbar.append(label, copy); block.append(toolbar, pre); parent.append(block);
  }
  function markdown(parent, text) {
    parent.replaceChildren();
    const lines = text.replace(/\r\n?/g, '\n').split('\n');
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const fence = /^\s*(`{3,}|~{3,})(.*)$/.exec(line);
      if (fence) {
        const content = []; i++;
        while (i < lines.length && !new RegExp(`^\\s*${fence[1][0]}{${fence[1].length},}\\s*$`).test(lines[i])) content.push(lines[i++]);
        codeBlock(parent, fence[2].trim(), content.join('\n')); if (i < lines.length) i++; continue;
      }
      if (!line.trim()) { i++; continue; }
      const heading = /^(#{1,6})\s+(.+)$/.exec(line);
      const list = /^\s*(?:([-+*])|\d+[.)])\s+(.+)$/.exec(line);
      if (heading) { const node = document.createElement(`h${Math.min(heading[1].length + 1, 4)}`); inline(node, heading[2]); parent.append(node); i++; }
      else if (list) {
        const ordered = !list[1]; const node = document.createElement(ordered ? 'ol' : 'ul');
        if (ordered) node.start = Number.parseInt(line.trim(), 10);
        while (i < lines.length) { const item = /^\s*(?:([-+*])|\d+[.)])\s+(.+)$/.exec(lines[i]); if (!item || !item[1] !== ordered) break; const li = document.createElement('li'); inline(li, item[2]); node.append(li); i++; }
        parent.append(node);
      } else if (/^>\s?/.test(line)) { const node = document.createElement('blockquote'); inline(node, line.replace(/^>\s?/, '')); parent.append(node); i++; }
      else { const node = document.createElement('p'); const paragraph = [line]; i++; while (i < lines.length && lines[i].trim() && !/^\s*(?:#{1,6}\s|`{3,}|~{3,}|>|[-+*]\s|\d+[.)]\s)/.test(lines[i])) paragraph.push(lines[i++]); inline(node, paragraph.join('\n')); parent.append(node); }
    }
  }
  function article(title, text, kind = 'assistant') {
    const node = document.createElement('article'); node.className = `message message-${kind}`;
    const heading = document.createElement('strong'); heading.className = 'message-heading'; heading.textContent = title;
    const content = document.createElement('div'); content.className = 'message-content';
    node.append(heading, content); $('messages').append(node);
    if (kind === 'user' || kind === 'error') content.textContent = text || ''; else markdown(content, text || '');
    if (kind === 'error') node.classList.add('error');
    return { node, content, text: text || '' };
  }
  function finishStream() { if (assistant) assistant.node.classList.remove('is-streaming'); assistant = null; }
  function setBusy(value) {
    busy = Boolean(value); document.body.classList.toggle('is-busy', busy);
    for (const control of document.querySelectorAll('[data-command],#backend,#model,#codex-model,#apply-model')) control.disabled = busy;
    $('send').disabled = busy; $('stop').disabled = !busy;
    $('messages').setAttribute('aria-busy', String(busy));
  }
  function usage(data) {
    for (const scope of ['turn', 'session']) {
      const value = data?.[scope]; const waiting = value?.requests === 0 || !value;
      const partial = value?.missing > 0 && typeof value?.totalTokens === 'number' ? ' · Parcial' : '';
      $(`usage-${scope}-total`).textContent = waiting ? 'Aguardando contagem' : number(value.totalTokens) + partial;
      const list = $(`usage-${scope}`); list.replaceChildren();
      for (const [key, label] of [['inputTokens', 'Entrada'], ['outputTokens', 'Saída'], ['totalTokens', 'Total'], ['cachedInputTokens', 'Entrada em cache (incluída)'], ['reasoningTokens', 'Raciocínio (incluído)'], ['requests', 'Requisições'], ['missing', 'Requisições com uso ausente/parcial']]) {
        const dt = document.createElement('dt'); dt.textContent = label; const dd = document.createElement('dd'); dd.textContent = waiting && !['requests', 'missing'].includes(key) ? 'Aguardando contagem' : number(value?.[key]); list.append(dt, dd);
      }
    }
  }
  function event(e) {
    if (!e || typeof e !== 'object') return;
    if (e.type === 'usage') { usage(e.usage || e); return; }
    follow(() => {
      if (e.type === 'user') { finishStream(); document.body.classList.remove('has-error'); article('Você', e.text, 'user'); }
      else if (e.type === 'start') { finishStream(); setBusy(true); statusText = 'Respondendo…'; $('status').textContent = statusText; assistant = article(selectedBackend === 'codex' ? 'Codex' : 'ChatGPT', ''); assistant.node.classList.add('is-streaming'); }
      else if (e.type === 'delta') { if (!assistant) assistant = article(selectedBackend === 'codex' ? 'Codex' : 'ChatGPT', ''); assistant.node.classList.add('is-streaming'); assistant.text += e.text || ''; markdown(assistant.content, assistant.text); }
      else if (e.type === 'done') { if (!assistant) assistant = article(selectedBackend === 'codex' ? 'Codex' : 'ChatGPT', ''); assistant.text = e.text || assistant.text; markdown(assistant.content, assistant.text); finishStream(); }
      else if (e.type === 'error') { finishStream(); article('Aviso', e.text, 'error'); document.body.classList.add('has-error'); statusText = 'Confira o aviso na conversa'; $('status').textContent = statusText; }
      else if (e.type === 'action') { const details = document.createElement('details'); details.className = 'action'; const summary = document.createElement('summary'); summary.textContent = `${e.name || 'Ação'}${e.status ? ` · ${e.status}` : ''}`; const pre = document.createElement('pre'); pre.textContent = typeof e.output === 'string' ? e.output : JSON.stringify(e.output ?? '', null, 2); details.append(summary, pre); $('messages').append(details); }
      else if (e.type === 'status') { statusText = e.text || e.status || 'Executando…'; $('status').textContent = statusText; }
    });
  }
  function clear() { finishStream(); $('messages').replaceChildren(); $('empty-state').hidden = false; document.body.classList.remove('has-error'); statusText = 'Pronto'; $('status').textContent = statusText; usage(null); }
  document.querySelectorAll('[data-command]').forEach(button => button.addEventListener('click', () => send(button.dataset.command)));
  $('backend').addEventListener('change', () => send('backend', $('backend').value));
  $('model').addEventListener('change', () => send('model', $('model').value));
  $('apply-model').addEventListener('click', () => send('model', $('codex-model').value.trim()));
  $('composer').addEventListener('submit', e => { e.preventDefault(); if (!busy && $('prompt').value.trim()) { const text = $('prompt').value; setBusy(true); $('status').textContent = 'Enviando…'; send('send', text); $('prompt').value = ''; } });
  $('prompt').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('composer').requestSubmit(); } });
  window.addEventListener('message', ({ data }) => {
    if (!data || typeof data !== 'object') return;
    if (data.type === 'clear') clear();
    else if (data.type === 'history') { clear(); for (const entry of data.entries || []) event(entry); }
    else if (data.type === 'event') event(data.event);
    else if (data.type === 'usage') usage(data.usage || data);
    else if (data.type === 'state') {
      const wasBusy = busy; setBusy(data.busy); selectedBackend = data.backend === 'codex' ? 'codex' : 'chatgpt';
      const codex = selectedBackend === 'codex'; $('backend').value = selectedBackend;
      $('directory').textContent = data.directory || 'Conversa sem pasta aberta'; $('directory').title = data.directory || '';
      $('model').hidden = codex; document.querySelector('label[for="model"]').hidden = codex;
      for (const id of ['codex-label', 'codex-model', 'apply-model']) $(id).hidden = !codex;
      $('models').hidden = codex; $('login').textContent = codex ? 'Entrar com Codex' : 'Entrar com ChatGPT';
      $('connection').textContent = codex ? 'Login e logout no terminal nativo · perfil local do Codex' : (data.connected ? 'ChatGPT conectado' : 'ChatGPT desconectado');
      $('plan-label').textContent = codex ? 'Codex · configuração local' : 'Plano ChatGPT · conexão direta';
      $('model').replaceChildren();
      for (const model of data.models || []) { const option = document.createElement('option'); option.value = model.slug; option.textContent = model.name || model.slug; $('model').append(option); }
      if (!$('model').options.length) { const option = document.createElement('option'); option.textContent = 'Entre para carregar modelos'; option.value = ''; $('model').append(option); }
      if (codex) { if (document.activeElement !== $('codex-model')) $('codex-model').value = data.model || ''; } else $('model').value = data.model || '';
      $('active-model').textContent = `${codex ? 'Codex' : 'ChatGPT'} · ${codex ? data.model || 'padrão do CLI' : $('model').selectedOptions[0]?.textContent || data.model || 'selecione um modelo'}`;
      if (data.usage !== undefined) usage(data.usage);
      if (!busy) { finishStream(); $('status').textContent = document.body.classList.contains('has-error') ? statusText : 'Pronto'; }
      else if (!wasBusy) $('status').textContent = 'Executando…';
    }
  });
  usage(null); send('ready');
})();
