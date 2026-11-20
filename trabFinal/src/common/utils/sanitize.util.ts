import { BadRequestException } from '@nestjs/common';

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
/** Campos que NUNCA são alterados (espaços/caracteres fazem parte da senha). */
const RAW_KEYS = new Set(['password', 'currentPassword', 'newPassword']);
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const HTML_TAGS = /<\/?[a-z][^>]*>/gi;
const MAX_DEPTH = 8;

export function sanitizeString(value: string): string {
  return value.normalize('NFC').replace(CONTROL_CHARS, '').replace(HTML_TAGS, '').trim();
}

/**
 * Sanitização básica e recursiva:
 *  - remove caracteres de controle e tags HTML, aplica trim e normalização Unicode (NFC);
 *  - descarta chaves de poluição de protótipo (__proto__, constructor, prototype);
 *  - limita a profundidade do objeto (evita payloads abusivos).
 */
export function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) throw new BadRequestException('Estrutura de dados muito profunda');
  if (typeof value === 'string') return sanitizeString(value);
  if (Array.isArray(value)) return value.map((v) => sanitizeValue(v, depth + 1));
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_KEYS.has(key)) continue;
      out[key] = RAW_KEYS.has(key) && typeof v === 'string' ? v : sanitizeValue(v, depth + 1);
    }
    return out;
  }
  return value;
}
