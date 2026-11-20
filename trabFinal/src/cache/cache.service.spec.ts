import { ConfigService } from '@nestjs/config';
import { AppCacheService } from './cache.service';

const makeCache = (ttl?: string) =>
  new AppCacheService({ get: (k: string) => (k === 'CACHE_TTL_SECONDS' ? ttl : undefined) } as unknown as ConfigService);

describe('AppCacheService', () => {
  it('executa o loader apenas uma vez (MISS depois HIT)', async () => {
    const cache = makeCache();
    const loader = jest.fn().mockResolvedValue({ n: 1 });
    const first = await cache.wrap('k', loader);
    const second = await cache.wrap('k', loader);
    expect(first.hit).toBe(false);
    expect(second.hit).toBe(true);
    expect(second.value).toEqual({ n: 1 });
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('invalida por prefixo (invalidação explícita)', async () => {
    const cache = makeCache();
    await cache.wrap('workouts:list:a', async () => 1);
    await cache.wrap('workouts:list:b', async () => 2);
    await cache.wrap('other:x', async () => 3);
    expect(cache.invalidatePrefix('workouts:')).toBe(2);
    expect((await cache.wrap('workouts:list:a', async () => 9)).hit).toBe(false);
    expect((await cache.wrap('other:x', async () => 9)).hit).toBe(true);
  });

  it('expira pelo TTL', async () => {
    const cache = makeCache();
    await cache.wrap('t', async () => 'v', 0.05);
    await new Promise((r) => setTimeout(r, 120));
    expect((await cache.wrap('t', async () => 'v2')).hit).toBe(false);
  });
});
