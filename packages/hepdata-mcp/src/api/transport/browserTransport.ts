/**
 * Browser-backed fallback transport for the HEPData fetch layer.
 *
 * When a plain HTTP request is met with a Cloudflare Managed Challenge (see
 * `challengeDetect.ts`), the *same* request can be retried through a real
 * headless browser (Playwright/Chromium) whose JS engine solves the challenge.
 * After the interstitial clears, the RAW response is fetched through the browser
 * context's request API — which carries the freshly-issued `cf_clearance`
 * cookie — so the caller receives the true network bytes (exact JSON, intact
 * binary), NOT serialized DOM. The rate limiter wraps that into a synthetic
 * `Response`, so the rest of the code is unchanged.
 *
 * Everything here is CONFINED TO THE FETCH LAYER. No caller knows a browser was
 * involved.
 *
 * Design constraints honored:
 *   - `playwright` is an OPTIONAL peer dependency, loaded via a runtime-built
 *     dynamic import so the package builds and runs WITHOUT playwright (or its
 *     Chromium) installed. It is only touched when `HEPDATA_BROWSER_FETCH` is
 *     opted in AND a challenge is hit.
 *   - The solver is INJECTABLE (module-level setter) so unit tests substitute a
 *     mock and never launch a real browser or hit the network.
 *   - SSRF confinement: in-browser requests are restricted to the HEPData host
 *     and the Cloudflare challenge platform; the final raw fetch is host-checked.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { upstreamError } from '@autoresearch/shared';
import { isCloudflareChallenge } from './challengeDetect.js';
import { defaultUrlCache, type UrlCache } from './urlCache.js';

/** The only data host the browser transport may navigate to / fetch from. */
const HEPDATA_ALLOWED_HOST = 'www.hepdata.net';

/**
 * Cloudflare serves the Managed Challenge widget/JS from this host (see the
 * challenge page CSP: `script-src https://challenges.cloudflare.com`). The
 * browser must be allowed to load it to SOLVE the challenge; every other host
 * is blocked so the headless browser cannot be steered into an SSRF.
 */
const CHALLENGE_PLATFORM_HOST = 'challenges.cloudflare.com';

/** Default budget for the whole browser solve (launch + navigate + clear poll). */
const DEFAULT_SOLVE_TIMEOUT_MS = 60_000;

/**
 * Per-process Chromium profile dir, created lazily on first use. A unique
 * `mkdtemp` directory (instead of a fixed shared path) avoids cross-process
 * collisions and scopes any persisted `cf_clearance` cookie to this process. It
 * is reused across solves WITHIN the process so a once-solved clearance is not
 * needlessly re-fetched.
 */
let userDataDirMemo: string | undefined;
function getUserDataDir(): string {
  if (userDataDirMemo === undefined) {
    userDataDirMemo = fs.mkdtempSync(path.join(os.tmpdir(), 'hep-mcp-cf-'));
  }
  return userDataDirMemo;
}

/**
 * Dynamically load `playwright` WITHOUT a compile-time module dependency.
 *
 * `playwright` is an OPTIONAL peer dep — the default install does not contain
 * it. A bare `import('playwright')` string literal is still resolved by `tsc`
 * under `module: NodeNext` and fails the build when the package is absent
 * (TS2307). Routing the specifier through a runtime-built variable makes the
 * import opaque to the type checker, so the package compiles with or without
 * playwright present; resolution happens purely at runtime, where a missing
 * module surfaces as a caught error (→ PlaywrightUnavailableError).
 *
 * Indirected via a mutable hook so tests can simulate an import failure without
 * uninstalling the package.
 */
function defaultImportPlaywright(): Promise<unknown> {
  // Built at runtime so the literal never reaches the module resolver.
  const specifier = ['play', 'wright'].join('');
  return import(/* @vite-ignore */ specifier);
}

let importPlaywrightImpl: () => Promise<unknown> = defaultImportPlaywright;

function importPlaywright(): Promise<unknown> {
  return importPlaywrightImpl();
}

/**
 * Override the playwright dynamic-import hook (tests inject a failing or stub
 * importer). Pass nothing to restore the real dynamic import.
 */
export function setPlaywrightImporter(fn?: () => Promise<unknown>): void {
  importPlaywrightImpl = fn ?? defaultImportPlaywright;
}

/**
 * Result of a browser solve: the final network response observed AFTER the
 * challenge cleared, as raw bytes so JSON is byte-exact and binary payloads are
 * not corrupted.
 */
export interface BrowserSolveResult {
  status: number;
  headers: Record<string, string>;
  body: Uint8Array;
}

/** Options handed to a solver for a single navigation. */
export interface BrowserSolveOptions {
  /** Upstream proxy server (e.g. `http://127.0.0.1:7890`), or undefined for direct. */
  proxy?: string;
  /** Persistent Chromium profile directory (confined, under the OS temp dir). */
  userDataDir: string;
  /** Overall solve budget in milliseconds. */
  timeoutMs: number;
  /** Optional cancellation signal (the rate limiter's request-timeout abort). */
  signal?: AbortSignal;
}

/**
 * A pluggable browser backend. The default is `PlaywrightSolver`; tests inject a
 * mock implementing this interface.
 */
export interface BrowserSolver {
  solve(url: string, opts: BrowserSolveOptions): Promise<BrowserSolveResult>;
}

/**
 * Assert a URL targets the allowed HEPData host over https. Throws otherwise so
 * the browser is never pointed at an attacker-influenced or downgraded URL.
 */
function assertHepdataUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw upstreamError(`Browser transport: not a parseable URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') {
    throw upstreamError(`Browser transport blocked (non-https scheme): ${parsed.protocol}`);
  }
  if (parsed.hostname !== HEPDATA_ALLOWED_HOST) {
    throw upstreamError(`Browser transport blocked (host not in allow-list): ${parsed.hostname}`);
  }
}

/**
 * Whether the headless browser may issue a request to `rawUrl`. Only the
 * HEPData data host and the Cloudflare challenge platform, both over https, are
 * permitted; everything else is aborted to preserve the SSRF confinement the
 * plain `rateLimiter.ts` path enforces via its redirect allow-list. Exported for
 * unit testing.
 */
export function isAllowedBrowserRequestUrl(rawUrl: string): boolean {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:') return false;
  return u.hostname === HEPDATA_ALLOWED_HOST || u.hostname === CHALLENGE_PLATFORM_HOST;
}

/**
 * Thrown (as an Error) by `PlaywrightSolver` when `import('playwright')` fails,
 * so `selectAndRun` can surface a precise "npm i playwright" remedy.
 */
export class PlaywrightUnavailableError extends Error {
  constructor(cause: unknown) {
    super(
      'Playwright is not installed. The Cloudflare browser fallback requires it. ' +
        'Install it in this package, then re-run: `npm i playwright` ' +
        '(or `pnpm add playwright`). A first run will also need Chromium: ' +
        '`npx playwright install chromium`.',
    );
    this.name = 'PlaywrightUnavailableError';
    this.cause = cause;
  }
}

/**
 * Default browser backend. Uses Playwright's persistent Chromium context to
 * solve the Cloudflare interstitial, then re-fetches the target URL through the
 * context's request API (carrying the issued cf_clearance cookie) to obtain the
 * raw response body.
 *
 * `playwright` is imported dynamically and typed as `any` so this file compiles
 * with no `@types/playwright` and no `playwright` install. The import is only
 * reached at runtime when the browser path is actually selected.
 */
export class PlaywrightSolver implements BrowserSolver {
  async solve(url: string, opts: BrowserSolveOptions): Promise<BrowserSolveResult> {
    assertHepdataUrl(url);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let playwright: any;
    try {
      playwright = await importPlaywright();
    } catch (err) {
      throw new PlaywrightUnavailableError(err);
    }

    const chromium = playwright.chromium ?? playwright.default?.chromium;
    if (!chromium) {
      throw new PlaywrightUnavailableError(
        new Error('playwright module did not export a `chromium` browser type'),
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let context: any;
    try {
      context = await chromium.launchPersistentContext(opts.userDataDir, {
        headless: true,
        proxy: opts.proxy ? { server: opts.proxy } : undefined,
      });

      // SSRF confinement: abort any in-browser request outside the allow-list
      // (HEPData host + Cloudflare challenge platform). This mirrors the manual
      // same-host redirect policy the plain fetch path enforces.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await context.route(/.*/, (route: any) => {
        if (isAllowedBrowserRequestUrl(route.request().url())) route.continue();
        else route.abort();
      });

      const page = await context.newPage();

      const deadline = Date.now() + opts.timeoutMs;
      const navTimeout = Math.max(1_000, Math.min(opts.timeoutMs, 30_000));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let lastResponse: any = await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: navTimeout,
      });

      // Poll until the challenge interstitial is gone (Chromium auto-solves the
      // Managed Challenge and reloads) or the budget runs out.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (opts.signal?.aborted) {
          throw upstreamError(`Browser transport aborted (request timeout) for ${url}.`);
        }
        const status: number = lastResponse?.status?.() ?? 200;
        const headerMap: Record<string, string> =
          typeof lastResponse?.headers === 'function' ? lastResponse.headers() : {};
        const bodyText: string = await page.content();

        if (!isCloudflareChallenge(status, new Headers(headerMap), bodyText)) break;

        if (Date.now() >= deadline) {
          throw upstreamError(
            'Browser transport: Cloudflare challenge did not clear within the ' +
              `timeout (${opts.timeoutMs} ms) for ${url}.`,
          );
        }

        const remaining = deadline - Date.now();
        try {
          lastResponse = await page.waitForNavigation({
            waitUntil: 'networkidle',
            timeout: Math.max(500, Math.min(remaining, 5_000)),
          });
        } catch {
          lastResponse = null;
        }
      }

      // Challenge cleared. Fetch the RAW response via the context's request API,
      // which shares the cookie jar (cf_clearance) with the page. This yields the
      // true network status/headers/bytes — not rendered DOM — so JSON is exact
      // and binary downloads are intact. `context.request` is NOT covered by the
      // page route allow-list above, so re-check the FINAL URL host explicitly.
      const apiResp = await context.request.get(url, {
        maxRedirects: 5,
        timeout: Math.max(1_000, deadline - Date.now()),
      });
      const finalUrl: string = typeof apiResp.url === 'function' ? apiResp.url() : url;
      if (!isAllowedBrowserRequestUrl(finalUrl)) {
        throw upstreamError(
          `Browser transport blocked (final URL host not in allow-list): ${finalUrl}`,
        );
      }
      const body = new Uint8Array(await apiResp.body());
      return { status: apiResp.status(), headers: apiResp.headers(), body };
    } finally {
      if (context) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await context.close().catch(() => {});
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Injectable solver + URL cache (for tests)
// ─────────────────────────────────────────────────────────────────────────────

let activeSolver: BrowserSolver = new PlaywrightSolver();
let activeCache: UrlCache = defaultUrlCache;

/** Override the browser backend (tests inject a mock; pass nothing to reset). */
export function setBrowserSolver(solver?: BrowserSolver): void {
  activeSolver = solver ?? new PlaywrightSolver();
}

/** Override the URL cache (tests inject a fresh instance; pass nothing to reset). */
export function setUrlCache(cache?: UrlCache): void {
  activeCache = cache ?? defaultUrlCache;
}

/** Current URL cache — used by the rate limiter for the pre-fetch lookup + writes. */
export function getUrlCache(): UrlCache {
  return activeCache;
}

/** Whether the browser fallback is opted in via env. */
export function browserFetchEnabled(): boolean {
  const raw = process.env.HEPDATA_BROWSER_FETCH?.trim().toLowerCase();
  if (!raw) return false;
  return raw !== '0' && raw !== 'false' && raw !== 'no' && raw !== 'off';
}

/**
 * Resolve the upstream proxy for the browser, mirroring how shells/curl read it.
 * Precedence: explicit HEPDATA_PROXY, then HTTPS_PROXY, then lower-case
 * https_proxy. Returns undefined for a direct connection.
 */
export function resolveProxy(): string | undefined {
  const candidate =
    process.env.HEPDATA_PROXY ?? process.env.HTTPS_PROXY ?? process.env.https_proxy;
  const trimmed = candidate?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Redact credentials embedded in a URL (e.g. a proxy `http://user:pass@host`)
 * before the string is placed in a surfaced error message.
 */
export function scrubSecrets(msg: string): string {
  return msg.replace(/([a-z][a-z0-9+.-]*:\/\/)[^/@\s]+@/gi, '$1***@');
}

/**
 * Build the precise, actionable error thrown when a Cloudflare challenge is hit
 * but the browser fallback is NOT opted in. Includes the `cf-ray` id when
 * present so the user can correlate with Cloudflare logs / support.
 */
export function challengeOptOutError(url: string, headers: Headers): ReturnType<typeof upstreamError> {
  const cfRay = headers.get('cf-ray');
  const rayNote = cfRay ? ` (cf-ray: ${cfRay})` : '';
  return upstreamError(
    `HEPData blocked this request with a Cloudflare Managed Challenge on the ` +
      `current egress IP${rayNote}: ${url}. A plain HTTP client cannot solve it. ` +
      `Remedies: (a) route through a clean/residential proxy node (set HEPDATA_PROXY ` +
      `or HTTPS_PROXY); or (b) enable the browser fallback by setting ` +
      `HEPDATA_BROWSER_FETCH=1 and installing Playwright (\`npm i playwright\` then ` +
      `\`npx playwright install chromium\`); or (c) move egress to a clean exit IP.`,
  );
}

/**
 * Selection + error policy for a detected Cloudflare challenge.
 *
 * Preconditions: the caller has already read the plain-fetch body, run
 * `isCloudflareChallenge`, and confirmed it IS a challenge. This function:
 *   1. If the browser fallback is opted OUT → throws `challengeOptOutError`.
 *   2. If opted IN → runs the active `BrowserSolver`. On `import('playwright')`
 *      failure (surfaced as `PlaywrightUnavailableError`) → throws a precise
 *      "install playwright" upstream error.
 *   3. On solver success → returns the raw `BrowserSolveResult`.
 *
 * Caching is intentionally NOT done here: the rate limiter applies the same
 * text-safe cache policy to browser-solved results as to plain ones (so a binary
 * download solved via the browser is never stringified into the cache).
 */
export async function selectAndRun(
  url: string,
  challengeHeaders: Headers,
  signal?: AbortSignal,
): Promise<BrowserSolveResult> {
  if (!browserFetchEnabled()) {
    throw challengeOptOutError(url, challengeHeaders);
  }

  try {
    return await activeSolver.solve(url, {
      proxy: resolveProxy(),
      userDataDir: getUserDataDir(),
      timeoutMs: DEFAULT_SOLVE_TIMEOUT_MS,
      signal,
    });
  } catch (err) {
    if (err instanceof PlaywrightUnavailableError) {
      throw upstreamError(err.message);
    }
    // Re-throw McpErrors (already precise) unchanged; wrap anything else, with
    // any embedded proxy credentials scrubbed from the message.
    if (err && typeof err === 'object' && 'code' in err) throw err;
    throw upstreamError(
      scrubSecrets(
        `Browser transport failed to solve the Cloudflare challenge for ${url}: ` +
          `${err instanceof Error ? err.message : String(err)}`,
      ),
    );
  }
}
