import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import NodeCache from 'node-cache';

/**
 * Cache em memória (node-cache) com TTL + invalidação explícita por prefixo.
 * ATENÇÃO: o cache é local a cada processo/réplica. Com várias réplicas, a invalidação explícita
 * só limpa a réplica que recebeu a escrita; as demais convergem pelo TTL (ver docs/ARQUITETURA.md).
 */
@Injectable()
export class AppCacheService {
  private readonly cache: NodeCache;
  private readonly logger = new Logger(AppCacheService.name);

  constructor(config: ConfigService) {
    const ttl = Number(config.get('CACHE_TTL_SECONDS') ?? 60);
    this.cache = new NodeCache({ stdTTL: ttl, checkperiod: 120, useClones: true, maxKeys: 1000 });
  }

  /** Retorna o valor em cache ou executa `loader`, guardando o resultado. */
  async wrap<T>(key: string, loader: () => Promise<T>, ttlSeconds?: number): Promise<{ value: T; hit: boolean }> {
    const cached = this.cache.get<T>(key);
    if (cached !== undefined) return { value: cached, hit: true };

    const value = await loader();
    try {
      if (ttlSeconds !== undefined) this.cache.set(key, value, ttlSeconds);
      else this.cache.set(key, value);
    } catch (err) {
      // Cache cheio (maxKeys): segue sem cachear em vez de falhar a requisição.
      this.logger.warn(`Não foi possível gravar no cache: ${(err as Error).message}`);
    }
    return { value, hit: false };
  }

  del(key: string): number {
    return this.cache.del(key);
  }

  /** Invalidação explícita: remove todas as chaves que começam com `prefix`. */
  invalidatePrefix(prefix: string): number {
    const keys = this.cache.keys().filter((k) => k.startsWith(prefix));
    return keys.length > 0 ? this.cache.del(keys) : 0;
  }

  flush() {
    this.cache.flushAll();
  }
}
