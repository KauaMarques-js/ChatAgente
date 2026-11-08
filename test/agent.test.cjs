const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Workspace } = require('../src/workspace.cjs');
const { Agent } = require('../src/agent.cjs');

function setup(t, approve) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatagente-agent-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return new Agent({ workspace: new Workspace(dir), client: { responses: {} }, approve });
}

test('agente só altera arquivo após aprovação do usuário', async t => {
  const agent = setup(t, async () => false);
  await assert.rejects(agent.executeTool('write_file', { path: 'novo.txt', content: 'oi' }), /recusada/);
  assert.equal(fs.existsSync(path.join(agent.workspace.root, 'novo.txt')), false);
  agent.approve = async () => true;
  assert.equal((await agent.executeTool('write_file', { path: 'novo.txt', content: 'oi' })).bytes, 2);
});

test('agente rejeita ferramenta desconhecida', async t => {
  const agent = setup(t, async () => true);
  await assert.rejects(agent.executeTool('execute_hidden', {}), /desconhecida/);
});

test('agente continua chamada de ferramenta usando API simulada, sem tráfego pago', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatagente-conversation-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, 'README.md'), '# Tarefa');
  let calls = 0;
  const mock = { responses: { create: async body => {
    calls++;
    if (calls === 2) {
      assert.ok(body.input.some(item => item.type === 'function_call_output' && item.call_id === 'call_1'));
    }
    return (async function* () {
      yield { type: 'response.completed', response: calls === 1 ? {
        status: 'completed', output: [{ type: 'function_call', call_id: 'call_1', name: 'read_file', arguments: '{"path":"README.md"}' }], output_text: '',
      } : {
        status: 'completed', output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: 'Li o README.', annotations: [] }] }], output_text: 'Li o README.',
      } };
    })();
  } } };
  const events = [];
  const agent = new Agent({ workspace: new Workspace(dir), client: mock, onEvent: ev => events.push(ev) });
  assert.equal(await agent.send('Leia o README'), 'Li o README.');
  assert.equal(calls, 2);
  assert.ok(events.some(e => e.name === 'read_file' && e.status === 'concluído'));
});
