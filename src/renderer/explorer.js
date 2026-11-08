(() => {
  const api = window.chatAgente;
  const $ = id => document.getElementById(id);
  let directory = '';
  let revision = 0;
  let previewRevision = 0;
  let selectedPath = '';
  let changes = [];
  const expanded = new Set(['.']);
  const labels = { M: 'Modificado', U: 'Não rastreado', A: 'Adicionado', D: 'Excluído', R: 'Renomeado', '!': 'Conflito' };

  function icon(entry) {
    if (entry.link) return ['↗', 'link'];
    if (entry.directory) return ['▱', `folder folder-${entry.name}`];
    const extension = entry.name.split('.').at(-1).toLowerCase();
    if (['js', 'cjs', 'mjs', 'jsx'].includes(extension)) return ['JS', 'javascript'];
    if (['ts', 'tsx'].includes(extension)) return ['TS', 'typescript'];
    if (extension === 'md') return ['M↓', 'markdown'];
    if (extension === 'json') return ['{}', 'json'];
    if (extension === 'css') return ['#', 'css'];
    if (extension === 'html') return ['◇', 'html'];
    if (entry.name.startsWith('.env')) return ['⚙', 'env'];
    if (entry.name.startsWith('.git')) return ['◆', 'git'];
    return ['≡', 'text'];
  }
  function decorate(row, entry) {
    row.classList.toggle('selected', entry.path === selectedPath);
    const exact = changes.find(change => change.path === entry.path);
    const nested = entry.directory && changes.some(change => change.path.startsWith(`${entry.path}/`));
    const status = exact?.status || (nested ? '•' : '');
    row.classList.toggle('git-modified', Boolean(status && status !== 'U'));
    row.classList.toggle('git-untracked', status === 'U');
    row.querySelector('.file-status').textContent = status;
    row.title = `${entry.path}${status ? ` · ${labels[status] || 'Contém alterações'}` : ''}${entry.link ? ' · Link (não seguido pelo explorador)' : ''}`;
  }
  function row(entry, folder) {
    const el = document.createElement(folder ? 'summary' : 'button');
    if (!folder) el.type = 'button';
    el.className = `explorer-row${folder ? ' folder-row' : ''}`;
    el.dataset.path = entry.path;
    const arrow = document.createElement('span');
    arrow.className = 'file-arrow';
    arrow.textContent = folder ? '›' : '';
    const glyph = document.createElement('span');
    const [symbol, type] = icon(entry);
    glyph.textContent = symbol;
    glyph.className = `file-icon ${type}`;
    const name = document.createElement('span');
    name.className = 'file-name';
    name.textContent = entry.name;
    const badge = document.createElement('span');
    badge.className = 'file-status';
    el.append(arrow, glyph, name, badge);
    decorate(el, entry);
    return el;
  }
  function closePreview() {
    previewRevision++;
    $('file-preview').hidden = true;
    document.querySelector('.chat-pane').classList.remove('show-preview');
  }
  async function openFile(entry, button) {
    const token = ++previewRevision;
    const project = directory;
    selectedPath = entry.path;
    $('explorer').querySelector('.selected')?.classList.remove('selected');
    button.classList.add('selected');
    $('file-preview').hidden = false;
    document.querySelector('.chat-pane').classList.add('show-preview');
    $('file-title').textContent = entry.path;
    $('file-content').textContent = 'Carregando...';
    try {
      if (entry.link) throw new Error('Links não são abertos pelo explorador.');
      const result = await api.readProjectFile({ directory: project, path: entry.path });
      if (token === previewRevision) $('file-content').textContent = result.content || '(arquivo vazio)';
    } catch (error) {
      if (token === previewRevision) $('file-content').textContent = `Não foi possível abrir: ${error.message}`;
    }
  }
  async function refresh() {
    if (!directory) return;
    const token = ++revision;
    const project = directory;
    $('explorer-message').textContent = 'Carregando arquivos...';
    const requests = new Map();
    const list = path => {
      if (!requests.has(path)) requests.set(path, api.listDirectory({ directory: project, path }));
      return requests.get(path);
    };
    const makeFolder = entry => {
      const details = document.createElement('details');
      details.dataset.path = entry.path;
      const heading = row(entry, true);
      const group = document.createElement('ul');
      group.className = 'file-group';
      details.append(heading, group);
      let pending;
      const load = () => {
        if (pending) return pending;
        group.textContent = 'Carregando...';
        pending = list(entry.path).then(entries => {
          if (token !== revision) return;
          group.replaceChildren();
          for (const child of entries) {
            const li = document.createElement('li');
            if (child.directory && !child.link) li.append(makeFolder(child));
            else {
              const button = row(child, false);
              button.addEventListener('click', () => void openFile(child, button));
              li.append(button);
            }
            group.append(li);
          }
          if (!entries.length) group.textContent = '(pasta vazia)';
        }).catch(error => {
          if (token !== revision) return;
          group.textContent = `Não foi possível listar: ${error.message}`;
          pending = null;
          requests.delete(entry.path);
        });
        return pending;
      };
      details.addEventListener('toggle', () => {
        if (token !== revision) return;
        if (details.open) { expanded.add(entry.path); void load(); }
        else expanded.delete(entry.path);
      });
      if (expanded.has(entry.path)) { details.open = true; void load(); }
      return details;
    };
    try {
      const [entries, git] = await Promise.all([list('.'), api.projectChanges({ directory: project }).catch(() => ({ changes: [], warning: 'Git indisponível.' }))]);
      if (token !== revision) return;
      changes = git.changes;
      const root = makeFolder({ name: project.split(/[\\/]/).filter(Boolean).at(-1) || project, path: '.', directory: true });
      $('explorer').replaceChildren(root);
      $('explorer-message').textContent = git.warning || (entries.length ? '' : 'Projeto vazio.');
    } catch (error) {
      if (token === revision) { $('explorer').replaceChildren(); $('explorer-message').textContent = `Não foi possível listar: ${error.message}`; }
    }
  }
  $('refresh-explorer').addEventListener('click', () => void refresh());
  $('collapse-explorer').addEventListener('click', () => {
    expanded.clear(); expanded.add('.');
    $('explorer').querySelectorAll('details').forEach(el => { el.open = el.dataset.path === '.'; });
  });
  $('close-preview').addEventListener('click', () => { closePreview(); $('prompt').focus(); });
  $('explorer').addEventListener('keydown', event => {
    const rows = [...$('explorer').querySelectorAll('.explorer-row')].filter(el => el.getClientRects().length);
    const index = rows.indexOf(document.activeElement);
    if (index < 0) return;
    const current = rows[index];
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? rows.length - 1 : Math.max(0, Math.min(rows.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)));
      rows[next].focus();
    } else if (event.key === 'ArrowRight' && current.tagName === 'SUMMARY') {
      event.preventDefault();
      if (!current.parentElement.open) current.parentElement.open = true;
      else rows[index + 1]?.focus();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      if (current.tagName === 'SUMMARY' && current.parentElement.open) current.parentElement.open = false;
      else current.parentElement.parentElement.closest('details')?.querySelector('summary')?.focus();
    }
  });
  window.projectExplorer = {
    refresh,
    closePreview,
    setProject(project) {
      if (project === directory) return;
      directory = project;
      $('explorer').replaceChildren();
      selectedPath = '';
      expanded.clear(); expanded.add('.');
      closePreview();
      void refresh();
    },
  };
})();
