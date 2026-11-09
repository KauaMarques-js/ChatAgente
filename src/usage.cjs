const FIELDS = ['inputTokens', 'outputTokens', 'totalTokens', 'cachedInputTokens', 'reasoningTokens'];
const count = value => Number.isSafeInteger(value) && value >= 0 ? value : null;

function normalizeUsage(raw, source = 'responses') {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const inputTokens = count(raw.input_tokens);
  const outputTokens = count(raw.output_tokens);
  const totalTokens = count(raw.total_tokens) ?? (inputTokens !== null && outputTokens !== null ? inputTokens + outputTokens : null);
  if (inputTokens === null && outputTokens === null && totalTokens === null) return null;
  return { inputTokens, outputTokens, totalTokens,
    cachedInputTokens: count(source === 'codex' ? raw.cached_input_tokens : raw.input_tokens_details?.cached_tokens),
    reasoningTokens: count(source === 'codex' ? raw.reasoning_output_tokens : raw.output_tokens_details?.reasoning_tokens) };
}
function emptyUsage() {
  return { inputTokens: null, outputTokens: null, totalTokens: null, cachedInputTokens: null, reasoningTokens: null, requests: 0, missing: 0 };
}
function addUsage(current, usage) {
  current.requests++;
  if (!usage || ['inputTokens', 'outputTokens', 'totalTokens'].some(key => count(usage[key]) === null)) current.missing++;
  for (const key of FIELDS) {
    const value = count(usage?.[key]);
    if (value !== null) current[key] = (current[key] ?? 0) + value;
  }
  return current;
}
module.exports = { normalizeUsage, emptyUsage, addUsage };
