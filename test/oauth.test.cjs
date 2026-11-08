const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { ChatGPTAuth, tokenFields, discover } = require('../src/chatgpt-auth.cjs');
const { Agent } = require('../src/agent.cjs');

test('OAuth completo simulado verifica PKCE, state, identidade e catálogo sem API key', async t => {
  const { generateKeyPair, exportJWK, SignJWT } = await import('jose');
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = { ...await exportJWK(publicKey), kid: 'test', alg: 'RS256', use: 'sig' };
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'chatagente-oauth-'));
  const originalFetch = global.fetch;
  t.after(async () => { global.fetch = originalFetch; await fs.rm(folder, { recursive: true, force: true }); });
  let authorization;
  let refreshed = 0;
  let revoked = false;
  const issuer = 'https://auth.openai.com';
  global.fetch = async (url, options = {}) => {
    url = String(url);
    if (url.startsWith('http://127.0.0.1:')) return originalFetch(url, options);
    if (url.endsWith('/.well-known/openid-configuration')) return Response.json({ issuer,
      authorization_endpoint: `${issuer}/test/authorize`, token_endpoint: `${issuer}/test/token`,
      jwks_uri: `${issuer}/test/jwks`, revocation_endpoint: `${issuer}/test/revoke` });
    if (url.endsWith('/test/jwks')) return Response.json({ keys: [jwk] });
    if (url.endsWith('/test/token')) {
      const body = new URLSearchParams(options.body);
      assert.equal(body.get('client_id'), 'oaiapp_test');
      assert.equal(body.get('resource'), 'https://api.openai.com/v1');
      if (body.get('grant_type') === 'refresh_token') {
        refreshed++;
        return Response.json({ access_token: 'renewed', refresh_token: 'rotated', token_type: 'Bearer', expires_in: 3600 });
      }
      assert.equal(body.get('redirect_uri'), authorization.searchParams.get('redirect_uri'));
      assert.equal(require('node:crypto').createHash('sha256').update(body.get('code_verifier')).digest('base64url'), authorization.searchParams.get('code_challenge'));
      const idToken = await new SignJWT({ nonce: authorization.searchParams.get('nonce'), email: 'test@example.test' })
        .setProtectedHeader({ alg: 'RS256', kid: 'test' }).setIssuer(issuer).setAudience('oaiapp_test')
        .setSubject('user-test').setIssuedAt().setExpirationTime('1h').sign(privateKey);
      return Response.json({ id_token: idToken, access_token: 'access', refresh_token: 'refresh',
        scope: 'openid offline_access chatgpt.tokens.use.direct', token_type: 'Bearer', expires_in: 3600 });
    }
    if (url.endsWith('/test/revoke')) { revoked = true; return new Response(null, { status: 200 }); }
    if (url === 'https://api.openai.com/v1/models') return Response.json({ models: [
      { slug: 'gpt-test', display_name: 'Modelo da conta', visibility: 'list' },
      { slug: 'hidden', display_name: 'Oculto', visibility: 'hide' },
    ] });
    throw new Error(`URL inesperada no teste: ${url}`);
  };
  const auth = new ChatGPTAuth({ directory: folder,
    safeStorage: { isEncryptionAvailable: () => true, encryptString: s => Buffer.from(s), decryptString: b => b.toString() },
    openBrowser: async url => {
      authorization = new URL(url);
      assert.equal(authorization.pathname, '/test/authorize');
      assert.equal(authorization.searchParams.get('client_id'), 'dynamic_agent_client');
      assert.equal(authorization.searchParams.has('id_token_hint'), false);
      const callback = new URL(authorization.searchParams.get('redirect_uri'));
      callback.search = new URLSearchParams({ state: 'wrong', code: 'code', client_id: 'oaiapp_test' });
      assert.equal((await originalFetch(callback)).status, 400);
      callback.searchParams.set('state', authorization.searchParams.get('state'));
      assert.equal((await originalFetch(callback)).status, 200);
    } });
  await auth.initialize();
  assert.equal((await auth.signIn()).sharing, true);
  assert.deepEqual(await auth.models(), [{ slug: 'gpt-test', name: 'Modelo da conta' }]);
  auth.record.expiresAt = 0;
  assert.deepEqual(await Promise.all([auth.accessToken(), auth.accessToken()]), ['renewed', 'renewed']);
  assert.equal(refreshed, 1);
  assert.equal(auth.record.refreshToken, 'rotated');
  await auth.disconnect();
  assert.equal(revoked, true);
  assert.equal(auth.status().connected, false);
});

test('OAuth rejeita endpoints externos e credenciais incompletas', async t => {
  const original = global.fetch;
  t.after(() => { global.fetch = original; });
  global.fetch = async () => Response.json({ issuer: 'https://auth.openai.com', authorization_endpoint: 'https://example.test/authorize' });
  await assert.rejects(discover(), /Endpoint OAuth/);
  assert.throws(() => tokenFields({ access_token: 'token' }), /incompletas/);
});

test('ChatGPT OAuth envia ferramentas em namespace e devolve o resultado ao modelo', async () => {
  let requests = 0;
  const agent = new Agent({ workspace: { root: 'C:\\example', listFiles: async () => ['README.md'] }, sharing: true,
    clientFactory: async () => ({ responses: { create: async request => {
      assert.equal(request.store, false);
      assert.equal(request.stream, true);
      assert.equal(request.tools[0].type, 'namespace');
      requests++;
      if (requests === 2) assert.equal(request.input.at(-1).output, '["README.md"]');
      return (async function* () {
        yield { type: 'response.completed', response: { status: 'completed', output_text: requests === 2 ? 'Concluído' : '',
          output: requests === 1 ? [{ type: 'function_call', name: 'list_files', namespace: 'local', call_id: 'call', arguments: '{"path":"."}' }] : [] } };
      })();
    } } }) });
  assert.equal(await agent.send('Liste os arquivos', new AbortController().signal), 'Concluído');
  assert.equal(requests, 2);
});
