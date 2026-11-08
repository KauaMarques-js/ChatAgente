const net = require('node:net');
const crypto = require('node:crypto');
const path = require('node:path');

// Um named pipe exclusivo coordena as janelas sem gravar segredos ou deixar lock após crash.
async function withAuthLock(directory, action, signal) {
  const identity = path.resolve(directory).toLowerCase();
  const name = `\\\\.\\pipe\\chatagente-auth-${crypto.createHash('sha256').update(identity).digest('hex').slice(0, 32)}`;
  let lock;
  while (!lock) {
    signal?.throwIfAborted();
    const server = net.createServer(socket => socket.destroy());
    try {
      await new Promise((resolve, reject) => { server.once('error', reject); server.listen(name, resolve); });
      lock = server;
      lock.unref();
    } catch (error) {
      if (error.code !== 'EADDRINUSE') throw error;
      await new Promise(resolve => setTimeout(resolve, 25));
    }
  }
  try { signal?.throwIfAborted(); return await action(); }
  finally { await new Promise(resolve => lock.close(resolve)); }
}

async function createProfileAuth(ChatGPTAuth, options, secrets, createSafeStorage) {
  const directory = options.directory;
  const auth = await withAuthLock(directory, async () => {
    const safeStorage = await createSafeStorage(secrets);
    const auth = new ChatGPTAuth({ ...options, safeStorage });
    await auth.initialize();
    return auth;
  });
  // Recarrega o registro antes da operação: outra janela pode ter renovado ou desconectado.
  for (const name of ['accessToken', 'signIn', 'disconnect']) {
    const original = auth[name].bind(auth);
    auth[name] = signal => withAuthLock(directory, async () => {
      auth.meta = null;
      auth.record = null;
      await auth.initialize();
      return name === 'signIn' ? original(signal) : original();
    }, signal);
  }
  return auth;
}
module.exports = { withAuthLock, createProfileAuth };
