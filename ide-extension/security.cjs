const crypto = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');

function safeError(error, secrets = []) {
  let text = error instanceof Error ? error.message : 'Operação não concluída.';
  for (const secret of secrets) if (typeof secret === 'string' && secret) text = text.split(secret).join('[redigido]');
  return text
    .replace(/\bBearer\s+[^\s,;"']+/gi, 'Bearer [redigido]')
    .replace(/\bsk-[\w-]+/g, '[redigido]')
    .replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[redigido]')
    .replace(/((?:access_token|refresh_token|id_token|api_key|authorization|code)\s*["']?\s*[:=]\s*["']?)[^\s&"',}]+/gi, '$1[redigido]');
}

function fileIdentity(filename) {
  let result = path.resolve(filename);
  try { result = fs.realpathSync(result); } catch { /* Arquivo novo ainda não existe. */ }
  return process.platform === 'win32' ? result.toLowerCase() : result;
}

function guardWorkspace(Workspace, documents) {
  return class EditorWorkspace extends Workspace {
    writeFile(relativePath, content) {
      if (typeof relativePath !== 'string') return super.writeFile(relativePath, content);
      const target = fileIdentity(path.resolve(this.root, relativePath));
      if (documents().some(doc => doc.isDirty && doc.uri.scheme === 'file' && fileIdentity(doc.uri.fsPath) === target)) {
        throw new Error('Arquivo com alterações não salvas no editor. Salve ou descarte as alterações antes de permitir a escrita.');
      }
      return super.writeFile(relativePath, content);
    }
  };
}

async function createSafeStorage(secrets) {
  const name = 'chatagente.aes-key.v1';
  let value = await secrets.get(name);
  if (!value) {
    value = crypto.randomBytes(32).toString('base64');
    await secrets.store(name, value);
  }
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32) throw new Error('Chave de armazenamento inválida.');
  return {
    isEncryptionAvailable: () => true,
    encryptString(text) {
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
      return Buffer.concat([Buffer.from([1]), iv, cipher.getAuthTag(), encrypted]);
    },
    decryptString(bytes) {
      if (bytes.length < 29 || bytes[0] !== 1) throw new Error('Registro criptografado inválido.');
      const cipher = crypto.createDecipheriv('aes-256-gcm', key, bytes.subarray(1, 13));
      cipher.setAuthTag(bytes.subarray(13, 29));
      return Buffer.concat([cipher.update(bytes.subarray(29)), cipher.final()]).toString('utf8');
    },
  };
}

const SIMPLE = new Set(['ready', 'open', 'stop', 'reset', 'login', 'logout', 'models', 'folder', 'terminal', 'git', 'explorer']);
function validateMessage(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if (SIMPLE.has(value.command)) return Object.keys(value).length === 1;
  if (Object.keys(value).length !== 2) return false;
  if (value.command === 'backend') return ['chatgpt', 'codex'].includes(value.value);
  if (value.command === 'model') return typeof value.value === 'string' && (value.value === '' || /^[\w./:-]{2,200}$/.test(value.value));
  if (value.command === 'send') return typeof value.value === 'string' && Boolean(value.value.trim());
  if (value.command === 'file') return typeof value.value === 'string' && Boolean(value.value.trim());
  return false;
}
module.exports = { createSafeStorage, validateMessage, guardWorkspace, safeError };
