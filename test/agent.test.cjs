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

function response(output = [], text = '') {
  return (async function* () {
    yield { type: 'response.completed', response: { status: 'completed', output, output_text: text } };
  })();
}
function readCall(index, file = `${index}.md`) {
  return { type: 'function_call', call_id: `read_${index}`, name: 'read_file', arguments: JSON.stringify({ path: file }) };
}

test('mapeia mais de 14 arquivos sem interromper a tarefa', async () => {
  let rounds = 0;
  const agent = new Agent({ workspace: { root: 'C:\\projeto', readFile: path => ({ path, content: path }) },
    client: { responses: { create: async () => ++rounds <= 18 ? response([readCall(rounds)]) : response([], 'Mapeamento concluído.') } } });
  assert.equal(await agent.send('Leia a documentação'), 'Mapeamento concluído.');
  assert.equal(rounds, 19);
});

test('continua além de 64 rodadas sem pausa automática nem ferramenta forçada', async () => {
  let rounds = 0;
  const events = [];
  const agent = new Agent({ workspace: { root: 'C:\\projeto', readFile: path => ({ path, content: path }) }, onEvent: event => events.push(event),
    sharing: true, client: { responses: { create: async body => {
      rounds++;
      assert.equal(body.tool_choice, undefined);
      assert.equal(body.tools[0].type, 'namespace');
      if (rounds <= 100) return response([readCall(rounds)]);
      assert.ok(body.input.some(item => item.type === 'function_call_output' && item.call_id === 'read_100'));
      return response([], 'Revisão concluída.');
    } } } });
  assert.equal(await agent.send('Mapeie o projeto'), 'Revisão concluída.');
  assert.equal(events.filter(event => event.type === 'paused').length, 0);
  assert.equal(rounds, 101);
});

test('consultas repetidas não forçam pausa nem exigem continuar', async () => {
  let requests = 0;
  let reads = 0;
  const agent = new Agent({ workspace: { root: 'C:\\projeto', readFile: () => { reads++; return { content: 'inalterado' }; } },
    client: { responses: { create: async body => {
      requests++;
      assert.equal(body.tool_choice, undefined);
      if (requests === 6) return response([], 'Concluído sem pausa.');
      return response([readCall(requests, 'README.md')]);
    } } } });
  assert.equal(await agent.send('Investigue'), 'Concluído sem pausa.');
  assert.equal(reads, 5);
  assert.equal(requests, 6);
});

test('comando do agente não recebe o limite de 30 segundos e mantém cancelamento', async () => {
  const controller = new AbortController();
  let received;
  const agent = new Agent({ workspace: { root: 'C:\\projeto', command: async (...args) => { received = args; return { exitCode: 0 }; } }, approve: async () => true });
  await agent.executeTool('run_command', { command: 'npm test' }, controller.signal);
  assert.equal(received[1], controller.signal);
  assert.equal(received[2].timeout, 0);
});

test('tarefa sem cota continua até Parar e preserva resultados anteriores', async () => {
  const controller = new AbortController();
  let rounds = 0;
  const agent = new Agent({ workspace: { root: 'C:\\projeto', readFile: path => ({ path, content: path }) },
    client: { responses: { create: async () => {
      rounds++;
      if (rounds === 150) controller.abort();
      return response([readCall(rounds)]);
    } } } });
  await assert.rejects(agent.send('Investigue até eu parar', controller.signal), /interrompida/);
  assert.equal(rounds, 150);
  assert.ok(agent.history.some(item => item.type === 'function_call_output' && item.call_id === 'read_149'));
});

test('leitura em lote mantém bloqueios, erros por arquivo e limite de conteúdo', async t => {
  const agent = setup(t);
  fs.writeFileSync(path.join(agent.workspace.root, 'a.md'), 'a'.repeat(90_000));
  fs.writeFileSync(path.join(agent.workspace.root, 'b.md'), 'b'.repeat(90_000));
  fs.writeFileSync(path.join(agent.workspace.root, 'c.md'), 'c'.repeat(90_000));
  fs.writeFileSync(path.join(agent.workspace.root, '.env'), 'segredo');
  const result = await agent.executeTool('local.read_files', { paths: ['a.md', '.env', 'ausente.md', 'b.md', 'c.md'] });
  assert.equal(result.files[0].content.length, 90_000);
  assert.match(result.files[1].error, /sensível/);
  assert.match(result.files[2].error, /inexistente/);
  assert.equal(result.files[3].content.length, 90_000);
  assert.match(result.files[4].error, /lote/);
  assert.throws(() => agent.workspace.writeFile('c.md', 'sem leitura'), /Leia o arquivo/);
  await assert.rejects(agent.executeTool('read_files', { paths: Array(9).fill('a.md') }), /1 a 8/);
});

test('falha de rede mantém resultados completos e não repete escrita ao continuar', async t => {
  const agent = setup(t, async () => true);
  let requests = 0;
  let writes = 0;
  const original = agent.workspace.writeFile.bind(agent.workspace);
  agent.workspace.writeFile = (...args) => { writes++; return original(...args); };
  agent.client.responses.create = async body => {
    requests++;
    if (requests === 1) return response([{ type: 'function_call', call_id: 'write_1', name: 'write_file', arguments: JSON.stringify({ path: 'novo.md', content: 'feito' }) }]);
    if (requests === 2) throw new Error('Falha de rede simulada');
    assert.ok(body.input.some(item => item.type === 'function_call_output' && item.call_id === 'write_1'));
    return response([], 'A escrita anterior já foi concluída.');
  };
  await assert.rejects(agent.send('Crie o arquivo'), /rede simulada/);
  assert.match(await agent.send('continuar'), /já foi concluída/);
  assert.equal(writes, 1);
});

test('cancelamento em resposta com várias ferramentas mantém pares e impede próximas escritas', async t => {
  const controller = new AbortController();
  const agent = setup(t, async () => true);
  const original = agent.workspace.writeFile.bind(agent.workspace);
  agent.workspace.writeFile = (...args) => { const result = original(...args); controller.abort(); return result; };
  agent.client.responses.create = async () => response(['primeiro.md', 'segundo.md'].map((file, i) => ({ type: 'function_call', call_id: `write_${i}`, name: 'write_file', arguments: JSON.stringify({ path: file, content: 'feito' }) })));
  await assert.rejects(agent.send('Crie arquivos', controller.signal), /interrompida/);
  assert.equal(fs.existsSync(path.join(agent.workspace.root, 'primeiro.md')), true);
  assert.equal(fs.existsSync(path.join(agent.workspace.root, 'segundo.md')), false);
  const outputs = agent.history.filter(item => item.type === 'function_call_output');
  assert.equal(outputs.length, 2);
  assert.match(outputs[1].output, /não iniciada/);
});
