// Codex SDK: usa a autenticação do Codex CLI do usuário, em thread separada.
class CodexAgent {
  constructor({ workspace, onEvent, codexFactory, sdkModule = '@openai/codex-sdk' }) {
    this.workspace = workspace;
    this.onEvent = onEvent;
    this.codexFactory = codexFactory || (async () => {
      const { Codex } = await import(sdkModule);
      return new Codex();
    });
    this.thread = null;
  }

  reset() { this.thread = null; }

  async send(message, signal) {
    if (!message?.trim()) throw new Error('Escreva uma mensagem.');
    if (!this.thread) {
      const codex = await this.codexFactory();
      this.thread = codex.startThread({
        workingDirectory: this.workspace.root,
        sandboxMode: 'workspace-write',
        approvalPolicy: 'never',
        skipGitRepoCheck: true,
      });
    }
    const { events } = await this.thread.runStreamed(message, { signal });
    const emitted = new Map();
    let answer = '';
    for await (const event of events) {
      if (signal?.aborted) throw new Error('Tarefa interrompida.');
      if (event.type === 'item.started' || event.type === 'item.updated' || event.type === 'item.completed') {
        const item = event.item;
        if (item.type === 'agent_message') {
          const before = emitted.get(item.id) || '';
          const next = item.text || '';
          if (next.startsWith(before)) {
            const delta = next.slice(before.length);
            if (delta) this.onEvent({ type: 'delta', text: delta });
          }
          emitted.set(item.id, next);
          if (event.type === 'item.completed') answer = next || answer;
        } else if (event.type === 'item.completed' && item.type === 'command_execution') {
          this.onEvent({ type: 'action', name: 'Codex · comando', status: item.status,
            output: `${item.command || ''}\n${item.aggregated_output || ''}`.slice(0, 2_000) });
        } else if (event.type === 'item.completed' && item.type === 'file_change') {
          this.onEvent({ type: 'action', name: 'Codex · arquivos', status: item.status,
            output: JSON.stringify(item.changes || []).slice(0, 2_000) });
        }
      } else if (event.type === 'turn.failed') {
        throw new Error(event.error?.message || 'A tarefa Codex falhou.');
      } else if (event.type === 'error') {
        throw new Error(event.message || 'Erro no Codex.');
      }
    }
    return answer || '(Codex concluiu sem mensagem final.)';
  }
}

module.exports = { CodexAgent };
