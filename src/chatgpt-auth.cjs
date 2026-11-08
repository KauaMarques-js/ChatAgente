// Sign in with ChatGPT (open-source, local client): OAuth/OIDC + PKCE.
// https://developers.openai.com/siwc/token-sharing-open-source/sign-in
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');

const AUTH = 'https://auth.openai.com';
const RESOURCE = 'https://api.openai.com/v1';
const SCOPES = 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct';
const SHARING = 'chatgpt.tokens.use.direct';

function publicSession(record) {
  return { connected: Boolean(record?.accessToken), sharing: Boolean(record?.scopes?.includes(SHARING)),
    email: record?.email || '', status: record?.accessToken ? 'connected' : 'disconnected' };
}

async function jsonResponse(url, options = {}) {
  const response = await fetch(url, { ...options, redirect: 'error', signal: options.signal || AbortSignal.timeout(30_000) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = typeof body.error === 'string' ? body.error : body.error?.code;
    throw new Error(`ChatGPT OAuth/API HTTP ${response.status}: ${code || body.detail || 'Falha na solicitação'}`);
  }
  return body;
}

async function verifyIdentity(idToken, clientId, nonce, expectedSubject, receivedAt) {
  const { createRemoteJWKSet, jwtVerify } = await import('jose');
  const discovery = await discover();
  const jwks = new URL(discovery.jwks_uri);
  if (discovery.issuer !== AUTH || jwks.protocol !== 'https:' || (jwks.hostname !== 'openai.com' && !jwks.hostname.endsWith('.openai.com'))) {
    throw new Error('Metadados de autenticação OpenAI inesperados.');
  }
  const keys = createRemoteJWKSet(jwks);
  const { payload } = await jwtVerify(idToken, keys, { issuer: AUTH, audience: clientId,
    algorithms: ['RS256'], requiredClaims: ['iss', 'aud', 'exp', 'iat', 'sub'], clockTolerance: 5,
    ...(receivedAt ? { currentDate: new Date(receivedAt) } : {}) });
  if (nonce && payload.nonce !== nonce) throw new Error('Nonce de autenticação inválido.');
  if ((payload.azp && payload.azp !== clientId) || (Array.isArray(payload.aud) && payload.aud.length > 1 && payload.azp !== clientId)) throw new Error('Destinatário OAuth inválido.');
  if (!payload.sub || (expectedSubject && payload.sub !== expectedSubject)) throw new Error('Conta ChatGPT não corresponde à conexão salva.');
  return { subject: payload.sub, email: typeof payload.email === 'string' ? payload.email : '' };
}

async function discover() {
  const config = await jsonResponse(`${AUTH}/.well-known/openid-configuration`);
  if (config.issuer !== AUTH) throw new Error('Emissor OAuth inesperado.');
  for (const key of ['authorization_endpoint', 'token_endpoint', 'jwks_uri', 'revocation_endpoint']) {
    if (key === 'revocation_endpoint' && !config[key]) continue;
    if (typeof config[key] !== 'string' || new URL(config[key]).origin !== AUTH) throw new Error('Endpoint OAuth inesperado.');
  }
  return config;
}

function tokenFields(data, previousScopes) {
  const scope = data.scope ?? previousScopes?.join(' ');
  if (typeof scope !== 'string' || typeof data.access_token !== 'string' || !data.access_token ||
      data.token_type?.toLowerCase() !== 'bearer' || !Number.isFinite(data.expires_in) || data.expires_in <= 0 ||
      typeof data.refresh_token !== 'string' || !data.refresh_token) throw new Error('Credenciais OAuth incompletas. Entre novamente.');
  return { accessToken: data.access_token, refreshToken: data.refresh_token,
    scopes: scope.split(/\s+/).filter(Boolean), expiresAt: Date.now() + data.expires_in * 1000 };
}

class ChatGPTAuth {
  constructor({ directory, safeStorage, openBrowser }) {
    this.directory = path.join(directory, 'chatgpt-connection');
    this.safeStorage = safeStorage;
    this.openBrowser = openBrowser;
    this.record = null;
    this.meta = null;
    this.refreshing = null;
    this.signingIn = false;
  }

  async initialize() {
    await fs.mkdir(this.directory, { recursive: true });
    const metaPath = path.join(this.directory, 'host.json');
    try { this.meta = JSON.parse(await fs.readFile(metaPath, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (!this.meta) {
      this.meta = { hostId: `urn:uuid:${crypto.randomUUID()}` };
      await this.saveMeta();
    }
    if (!this.safeStorage.isEncryptionAvailable()) throw new Error('Armazenamento criptografado do Windows não disponível.');
    try {
      const bytes = await fs.readFile(path.join(this.directory, 'connection.enc'));
      const record = JSON.parse(this.safeStorage.decryptString(bytes));
      if (record.clientId !== this.meta.clientId) throw new Error('Registro OAuth incompatível.');
      this.record = record;
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    return this.status();
  }

  status() { return publicSession(this.record); }

  async saveMeta() {
    await fs.writeFile(path.join(this.directory, 'host.json'), JSON.stringify(this.meta), { mode: 0o600 });
  }

  async saveRecord(record) {
    if (!this.safeStorage.isEncryptionAvailable()) throw new Error('Proteção de credenciais indisponível.');
    const encrypted = this.safeStorage.encryptString(JSON.stringify(record));
    const target = path.join(this.directory, 'connection.enc');
    const temp = `${target}.${crypto.randomUUID()}.tmp`;
    await fs.writeFile(temp, encrypted, { mode: 0o600 });
    await fs.rename(temp, target);
    this.record = record;
  }

  async exchange(values) {
    const config = await discover();
    return jsonResponse(config.token_endpoint, {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ ...values, resource: RESOURCE }).toString(),
    });
  }

  async signIn(signal) {
    if (this.signingIn) throw new Error('Login ChatGPT já em andamento.');
    this.signingIn = true;
    const state = crypto.randomBytes(32).toString('base64url');
    const nonce = crypto.randomBytes(32).toString('base64url');
    const verifier = crypto.randomBytes(48).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    let server;
    let timer;
    let onAbort;
    try {
      const config = await discover();
      // Listener local exclusivo e temporário; nunca recebe a senha do usuário.
      let resolveCallback;
      let rejectCallback;
      const callback = new Promise((resolve, reject) => { resolveCallback = resolve; rejectCallback = reject; });
      callback.catch(() => {}); // Callback pode chegar antes de openBrowser terminar.
      onAbort = () => rejectCallback(new Error('Login ChatGPT interrompido.'));
      signal?.addEventListener('abort', onAbort, { once: true });
      signal?.throwIfAborted();
      server = http.createServer((req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Referrer-Policy', 'no-referrer');
        res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
        const origin = `http://127.0.0.1:${server.address().port}`;
        let url;
        try { url = new URL(req.url || '/', origin); } catch { res.writeHead(400).end(); return; }
        if (req.method !== 'GET' || req.headers.host !== new URL(origin).host || url.origin !== origin || url.pathname !== '/auth/callback') {
          res.writeHead(404).end(); return;
        }
        if (url.searchParams.getAll('state').length !== 1 || url.searchParams.get('state') !== state) {
          res.writeHead(400, { 'content-type': 'text/plain' }).end('Estado inválido.');
          return;
        }
        const error = url.searchParams.get('error');
        if (error) rejectCallback(new Error(`Autorização ChatGPT: ${error}`));
        else resolveCallback(url.searchParams);
        res.writeHead(error ? 400 : 200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
          .end('<!doctype html><meta charset="utf-8"><title>ChatAgente</title><p>Login recebido. Volte para o ChatAgente.</p>');
      });
      await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
      const port = server.address().port;
      const redirectUri = `http://127.0.0.1:${port}/auth/callback`;
      const clientId = this.meta.clientId || 'dynamic_agent_client';
      const url = new URL(config.authorization_endpoint);
      const params = {
        client_id: clientId, response_type: 'code', redirect_uri: redirectUri, scope: SCOPES,
        resource: RESOURCE, state, nonce, code_challenge_method: 'S256', code_challenge: challenge,
        ext_agent_host_id: this.meta.hostId,
      };
      if (clientId === 'dynamic_agent_client') params.agent_name_hint = 'ChatAgente';
      else if (this.record?.email) params.login_hint = this.record.email;
      if (this.record && !this.status().sharing) params.prompt = 'consent';
      for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
      timer = setTimeout(() => rejectCallback(new Error('Tempo para login ChatGPT esgotado.')), 180_000);
      await this.openBrowser(url.toString());
      const query = await callback;
      const code = query.get('code');
      const issuedId = query.get('client_id') || this.meta.clientId;
      if (!code || query.getAll('code').length !== 1 || query.getAll('client_id').length > 1 || !issuedId || !/^[a-zA-Z0-9_-]{1,200}$/.test(issuedId) || issuedId === 'dynamic_agent_client') throw new Error('Registro do aplicativo não foi concluído pelo ChatGPT.');
      if (this.meta.clientId && this.meta.clientId !== issuedId) throw new Error('Registro OAuth inesperado; login rejeitado.');
      if (!this.meta.clientId) { this.meta.clientId = issuedId; await this.saveMeta(); }
      const tokens = await this.exchange({ grant_type: 'authorization_code', client_id: issuedId,
        code, code_verifier: verifier, redirect_uri: redirectUri });
      if (!tokens.id_token || !tokens.access_token) throw new Error('Resposta OAuth incompleta.');
      const identity = await verifyIdentity(tokens.id_token, issuedId, nonce, this.record?.subject);
      signal?.throwIfAborted();
      const record = {
        clientId: issuedId, subject: identity.subject, email: identity.email,
        idToken: tokens.id_token, ...tokenFields(tokens),
        earliestRefreshAt: tokens.earliest_refresh_at,
      };
      await this.saveRecord(record);
      return this.status();
    } finally {
      this.signingIn = false;
      clearTimeout(timer);
      if (onAbort) signal?.removeEventListener('abort', onAbort);
      if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    }
  }

  async accessToken() {
    if (!this.record?.accessToken) throw new Error('Conecte sua conta em “Entrar com ChatGPT”.');
    if (!this.record.scopes.includes(SHARING)) throw new Error('A conta está conectada, mas não autorizou uso do plano ChatGPT. Faça login novamente e autorize.');
    if (!this.record.pendingRefresh && this.record.expiresAt > Date.now() + 90_000) return this.record.accessToken;
    if (!this.refreshing) this.refreshing = this.refresh().finally(() => { this.refreshing = null; });
    return this.refreshing;
  }

  async refresh() {
    if (!this.record?.refreshToken) throw new Error('Sessão ChatGPT expirada. Entre novamente.');
    const previous = this.record;
    let pending = previous.pendingRefresh;
    if (!pending) {
      const data = await this.exchange({ grant_type: 'refresh_token', client_id: previous.clientId, refresh_token: previous.refreshToken });
      pending = { ...tokenFields(data, previous.scopes), idToken: data.id_token, receivedAt: Date.now() };
      if (data.id_token !== undefined && (typeof data.id_token !== 'string' || !data.id_token)) throw new Error('Identidade renovada inválida.');
      // Preserva rotação mesmo se a consulta de chaves falhar temporariamente.
      await this.saveRecord({ ...previous, pendingRefresh: pending });
    }
    const identity = pending.idToken ? await verifyIdentity(pending.idToken, previous.clientId, undefined, previous.subject, pending.receivedAt) : {};
    const updated = {
      ...previous, ...pending, email: identity.email || previous.email, idToken: pending.idToken || previous.idToken,
    };
    delete updated.pendingRefresh;
    await this.saveRecord(updated);
    return updated.accessToken;
  }

  async models() {
    const token = await this.accessToken();
    const result = await jsonResponse(`${RESOURCE}/models`, { headers: { authorization: `Bearer ${token}` } });
    if (!Array.isArray(result.models)) throw new Error('Catálogo de modelos ChatGPT inválido.');
    return result.models.filter(m => m.visibility === 'list').map(m => {
      if (typeof m.slug !== 'string' || !m.slug || typeof m.display_name !== 'string') throw new Error('Modelo ChatGPT inválido.');
      return { slug: m.slug, name: m.display_name };
    });
  }

  async disconnect() {
    if (this.signingIn) throw new Error('Conclua o login antes de desconectar.');
    if (this.refreshing) await this.refreshing.catch(() => {});
    const previous = this.record;
    this.record = null;
    await fs.rm(path.join(this.directory, 'connection.enc'), { force: true });
    let warning = '';
    const token = previous?.pendingRefresh?.refreshToken || previous?.refreshToken;
    if (token) {
      try {
        const config = await discover();
        if (!config.revocation_endpoint) throw new Error('Revogação indisponível.');
        const response = await fetch(config.revocation_endpoint, { method: 'POST', redirect: 'error',
          signal: AbortSignal.timeout(10_000), headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ token, token_type_hint: 'refresh_token', client_id: previous.clientId }) });
        await response.body?.cancel();
        if (response.status !== 200) throw new Error('Revogação não confirmada.');
      } catch { warning = 'Credenciais locais apagadas; revogação remota não confirmada. Desconecte o aplicativo nas configurações do ChatGPT.'; }
    }
    return { ...this.status(), ...(warning ? { warning } : {}) };
  }
}

module.exports = { ChatGPTAuth, publicSession, verifyIdentity, discover, tokenFields };
