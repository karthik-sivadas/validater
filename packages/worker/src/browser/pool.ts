import { chromium } from 'playwright';
import type { Browser } from 'playwright';
import { createPool, type Pool } from 'generic-pool';
import { checkMemoryHealth } from './memory-monitor.js';

export interface PooledBrowser {
  browser: Browser;
  createdAt: number;
  pagesProcessed: number;
}

export interface BrowserPoolConfig {
  /** Maximum concurrent browsers (default 3, env BROWSER_POOL_MAX) */
  maxBrowsers?: number;
  /** Minimum idle browsers (default 1, env BROWSER_POOL_MIN) */
  minBrowsers?: number;
  /** Maximum browser lifetime in ms (default 5 min) */
  maxLifetimeMs?: number;
  /** Maximum pages before browser retirement (default 50) */
  maxPagesPerBrowser?: number;
  /** Timeout when acquiring browser from pool in ms (default 30s) */
  acquireTimeoutMs?: number;
  /** Idle timeout before browser is destroyed in ms (default 60s) */
  idleTimeoutMs?: number;
  /** Eviction check interval in ms (default 30s) */
  evictionIntervalMs?: number;
}

const DEFAULT_MAX_BROWSERS = 3;
const DEFAULT_MIN_BROWSERS = 1;
const DEFAULT_MAX_LIFETIME_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_MAX_PAGES = 50;
const DEFAULT_ACQUIRE_TIMEOUT_MS = 30_000;
const DEFAULT_IDLE_TIMEOUT_MS = 60_000;
const DEFAULT_EVICTION_INTERVAL_MS = 30_000;

/**
 * Create a browser pool backed by generic-pool.
 *
 * Each pooled browser tracks creation time and pages processed.
 * The pool's validate function checks:
 *   1. Browser is still connected
 *   2. Lifetime has not exceeded maxLifetimeMs
 *   3. Pages processed has not exceeded maxPagesPerBrowser
 *   4. Process memory is healthy (RSS + heap within thresholds)
 *
 * When validation fails, the pool destroys the browser and creates a fresh one.
 */
export function createBrowserPool(config?: BrowserPoolConfig): Pool<PooledBrowser> {
  const maxBrowsers = config?.maxBrowsers
    ?? (process.env.BROWSER_POOL_MAX ? parseInt(process.env.BROWSER_POOL_MAX, 10) : DEFAULT_MAX_BROWSERS);
  const minBrowsers = config?.minBrowsers
    ?? (process.env.BROWSER_POOL_MIN ? parseInt(process.env.BROWSER_POOL_MIN, 10) : DEFAULT_MIN_BROWSERS);
  const maxLifetimeMs = config?.maxLifetimeMs ?? DEFAULT_MAX_LIFETIME_MS;
  const maxPagesPerBrowser = config?.maxPagesPerBrowser ?? DEFAULT_MAX_PAGES;
  const acquireTimeoutMs = config?.acquireTimeoutMs ?? DEFAULT_ACQUIRE_TIMEOUT_MS;
  const idleTimeoutMs = config?.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS;
  const evictionIntervalMs = config?.evictionIntervalMs ?? DEFAULT_EVICTION_INTERVAL_MS;

  const factory = {
    async create(): Promise<PooledBrowser> {
      const browser = await chromium.launch({ headless: true });
      return {
        browser,
        createdAt: Date.now(),
        pagesProcessed: 0,
      };
    },

    async destroy(pooled: PooledBrowser): Promise<void> {
      try {
        await pooled.browser.close();
      } catch {
        // Browser may already be disconnected -- swallow close errors
      }
    },

    async validate(pooled: PooledBrowser): Promise<boolean> {
      // 1. Browser must still be connected
      if (!pooled.browser.isConnected()) return false;
      // 2. Must not exceed max lifetime
      if (Date.now() - pooled.createdAt >= maxLifetimeMs) return false;
      // 3. Must not exceed max pages
      if (pooled.pagesProcessed >= maxPagesPerBrowser) return false;
      // 4. Process memory must be healthy
      if (!checkMemoryHealth().healthy) return false;

      return true;
    },
  };

  return createPool(factory, {
    max: maxBrowsers,
    min: minBrowsers,
    testOnBorrow: true,
    acquireTimeoutMillis: acquireTimeoutMs,
    idleTimeoutMillis: idleTimeoutMs,
    evictionRunIntervalMillis: evictionIntervalMs,
  });
}

// Lazy singleton pool
let _pool: Pool<PooledBrowser> | null = null;

/**
 * Get the default browser pool singleton.
 * Creates the pool on first call with default configuration.
 */
export function getDefaultPool(): Pool<PooledBrowser> {
  if (!_pool) {
    _pool = createBrowserPool();
  }
  return _pool;
}

/**
 * Gracefully drain and clear the browser pool.
 * Waits for all acquired browsers to be released, then destroys them.
 * Resets the singleton so a new pool can be created on next getDefaultPool() call.
 */
export async function shutdownPool(): Promise<void> {
  if (_pool) {
    await _pool.drain();
    await _pool.clear();
    _pool = null;
  }
}
