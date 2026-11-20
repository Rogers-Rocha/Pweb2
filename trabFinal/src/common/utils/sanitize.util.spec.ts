import { BadRequestException } from '@nestjs/common';
import { sanitizeString, sanitizeValue } from './sanitize.util';

describe('sanitize.util', () => {
  it('remove tags HTML, caracteres de controle e aplica trim', () => {
    expect(sanitizeString('  <script>alert(1)</script>Ana\u0000  ')).toBe('alert(1)Ana');
  });

  it('descarta chaves de poluição de protótipo', () => {
    const malicious = JSON.parse('{"name":"x","__proto__":{"admin":true},"constructor":{"a":1}}');
    const out = sanitizeValue(malicious) as Record<string, unknown>;
    expect(Object.keys(out)).toEqual(['name']);
    expect(({} as Record<string, unknown>).admin).toBeUndefined();
  });

  it('não altera o campo password', () => {
    const out = sanitizeValue({ email: ' a@b.com ', password: '  <b>segredo</b>  ' }) as Record<string, string>;
    expect(out.email).toBe('a@b.com');
    expect(out.password).toBe('  <b>segredo</b>  ');
  });

  it('sanitiza arrays e objetos aninhados', () => {
    const out = sanitizeValue({ exercises: [{ name: ' <i>Supino</i> ' }] }) as { exercises: { name: string }[] };
    expect(out.exercises[0].name).toBe('Supino');
  });

  it('rejeita estruturas profundas demais', () => {
    let deep: unknown = 'x';
    for (let i = 0; i < 20; i++) deep = { a: deep };
    expect(() => sanitizeValue(deep)).toThrow(BadRequestException);
  });
});
