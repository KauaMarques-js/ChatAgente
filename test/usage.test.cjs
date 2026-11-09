const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeUsage, emptyUsage, addUsage } = require('../src/usage.cjs');
const { Agent } = require('../src/agent.cjs');

test('tokens de cache/raciocínio são subconjuntos, não são somados novamente ao total', () => {
  const usage = normalizeUsage({ input_tokens: 100, output_tokens: 40, total_tokens: 140,
    input_tokens_details: { cached_tokens: 70 }, output_tokens_details: { reasoning_tokens: 30 } });
  assert.deepEqual(usage, { inputTokens: 100, outputTokens: 40, totalTokens: 140, cachedInputTokens: 70, reasoningTokens: 30 });
  assert.equal(normalizeUsage({ input_tokens: 20, cached_input_tokens: 12, output_tokens: 5, reasoning_output_tokens: 3 }, 'codex').totalTokens, 25);
});

test('uso ausente e parcial não são exibidos como consumo zero', () => {
  const accumulator = emptyUsage();
  assert.equal(accumulator.totalTokens, null);
  addUsage(accumulator, null);
  assert.equal(accumulator.totalTokens, null);
  addUsage(accumulator, normalizeUsage({ input_tokens: 30, output_tokens: 10, total_tokens: 40 }));
  addUsage(accumulator, normalizeUsage({ input_tokens: 5 }));
  assert.equal(accumulator.totalTokens, 40);
  assert.equal(accumulator.inputTokens, 35);
  assert.equal(accumulator.requests, 3);
  assert.equal(accumulator.missing, 2);
  assert.equal(normalizeUsage({ input_tokens: -1, output_tokens: '10', total_tokens: NaN }), null);
  assert.equal(normalizeUsage({ input_tokens: 0, output_tokens: 0 }).totalTokens, 0);
});

test('ChatGPT conversa sem projeto, sem ferramentas nem execução Codex', async () => {
  const events = [];
  const agent = new Agent({ client: { responses: { create: async body => {
    assert.deepEqual(body.tools, []);
    assert.match(body.instructions, /perguntas simples/);
    return (async function* () { yield { type: 'response.completed', response: { status: 'completed', output: [], output_text: 'Olá!', usage: { input_tokens: 10, output_tokens: 2, total_tokens: 12 } } }; })();
  } } }, onEvent: event => events.push(event) });
  assert.equal(await agent.send('Olá'), 'Olá!');
  assert.equal(events.find(event => event.type === 'usage').usage.totalTokens, 12);
  await assert.rejects(agent.executeTool('run_command', { command: 'exit' }), /Abra um projeto/);
});

test('cada rodada tem uso próprio, incluindo falha sem metadados', async () => {
  let requests = 0;
  const observed = [];
  const agent = new Agent({ workspace: { root: '.', readFile: () => ({ content: 'oi' }) }, onEvent: event => observed.push(event),
    client: { responses: { create: async () => {
      requests++;
      if (requests === 2) throw new Error('rede simulada');
      return (async function* () { yield { type: 'response.completed', response: { status: 'completed', output: [{ type: 'function_call', name: 'read_file', call_id: '1', arguments: '{"path":"a.md"}' }], usage: { input_tokens: 20, output_tokens: 5, total_tokens: 25 } } }; })();
    } } } });
  await assert.rejects(agent.send('Leia'), /rede simulada/);
  const usage = observed.filter(event => event.type === 'usage');
  assert.equal(usage.length, 2);
  assert.equal(usage[0].usage.totalTokens, 25);
  assert.equal(usage[1].usage, null);
});

test('resposta incompleta mantém o uso que o serviço já informou', async () => {
  const events = [];
  const agent = new Agent({ onEvent: event => events.push(event), client: { responses: { create: async () => (async function* () {
    yield { type: 'response.incomplete', response: { usage: { input_tokens: 80, output_tokens: 20, total_tokens: 100 } } };
  })() } } });
  await assert.rejects(agent.send('Teste'), /incompleta/);
  assert.equal(events.filter(event => event.type === 'usage').length, 1);
  assert.equal(events.find(event => event.type === 'usage').usage.totalTokens, 100);
});
