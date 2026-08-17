const fixedPatterns: ReadonlyArray<RegExp> = [
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}\b/g,
  /\bgh[pousr]_[A-Za-z0-9]{16,}\b/g,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
  /\bBearer\s+[A-Za-z0-9._~+/-]{12,}={0,2}\b/gi,
  /\b(?:api[_-]?key|access[_-]?token|auth[_-]?token|secret|password)\b\s*[:=]\s*["']?[^\s,"']{8,}["']?/gi,
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function redactText(text: string, environment: NodeJS.ProcessEnv = process.env): string {
  let redacted = text;
  for (const pattern of fixedPatterns) redacted = redacted.replace(pattern, "[REDACTED]");

  for (const [name, value] of Object.entries(environment)) {
    if (!/(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)/i.test(name) || !value || value.length < 8) {
      continue;
    }
    redacted = redacted.replace(new RegExp(escapeRegExp(value), "g"), "[REDACTED]");
  }
  return redacted;
}
