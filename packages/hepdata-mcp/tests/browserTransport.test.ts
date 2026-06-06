import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type BrowserSolveOptions,
  type BrowserSolveResult,
  type BrowserSolver,
  browserFetchEnabled,
  challengeOptOutError,
  fetchRawFollowingRedirects,
  isAllowedBrowserRequestUrl,
  PlaywrightSolver,
  PlaywrightUnavailableError,
  type RawApiResponse,
  type RawGetter,
  resolveProxy,
  scrubSecrets,
  selectAndRun,
  setBrowserSolver,
  setPlaywrightImporter,
  setUrlCache,
} from '../src/api/transport/browserTransport.js';
import { UrlCache } from '../src/api/transport/urlCache.js';

const URL = 'https://www.hepdata.net/record/123?format=json';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);
const dec = (b: Uint8Array): string => new TextDecoder().decode(b);

// A mock solver that records its inputs and returns a canned result.
function mockSolver(result: BrowserSolveResult): { solver: BrowserSolver; calls: Array<{ url: string; opts: BrowserSolveOptions }> } {
  const calls: Array<{ url: string; opts: BrowserSolveOptions }> = [];
  const solver: BrowserSolver = {
    async solve(url, opts) {
      calls.push({ url, opts });
      return result;
    },
  };
  return { solver, calls };
}

// Snapshot + restore the env vars these tests mutate.
const ENV_KEYS = ['HEPDATA_BROWSER_FETCH', 'HEPDATA_PROXY', 'HTTPS_PROXY', 'https_proxy'] as const;
let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  savedEnv = {};
  for (const k of ENV_KEYS) {
    savedEnv[k] = process.env[k];
    delete process.env[k];
  }
  setUrlCache(new UrlCache(8));
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] !== undefined) process.env[k] = savedEnv[k];
    else delete process.env[k];
  }
  setBrowserSolver(); // restore PlaywrightSolver
  setUrlCache(); // restore default cache
  setPlaywrightImporter(); // restore real importer
  vi.restoreAllMocks();
});

describe('browserFetchEnabled — opt-in parsing', () => {
  it('is false when unset', () => {
    expect(browserFetchEnabled()).toBe(false);
  });

  it.each(['1', 'true', 'yes', 'on', 'TRUE'])('is true for %s', (v) => {
    process.env.HEPDATA_BROWSER_FETCH = v;
    expect(browserFetchEnabled()).toBe(true);
  });

  it.each(['0', 'false', 'no', 'off', '', '  '])('is false for falsey %j', (v) => {
    process.env.HEPDATA_BROWSER_FETCH = v;
    expect(browserFetchEnabled()).toBe(false);
  });
});

describe('resolveProxy — env precedence', () => {
  it('returns undefined when no proxy env is set', () => {
    expect(resolveProxy()).toBeUndefined();
  });

  it('prefers HEPDATA_PROXY over HTTPS_PROXY and https_proxy', () => {
    process.env.HEPDATA_PROXY = 'http://hep:1';
    process.env.HTTPS_PROXY = 'http://upper:2';
    process.env.https_proxy = 'http://lower:3';
    expect(resolveProxy()).toBe('http://hep:1');
  });

  it('falls back to HTTPS_PROXY then https_proxy', () => {
    process.env.HTTPS_PROXY = 'http://upper:2';
    process.env.https_proxy = 'http://lower:3';
    expect(resolveProxy()).toBe('http://upper:2');

    delete process.env.HTTPS_PROXY;
    expect(resolveProxy()).toBe('http://lower:3');
  });

  it('treats whitespace-only as unset', () => {
    process.env.HEPDATA_PROXY = '   ';
    expect(resolveProxy()).toBeUndefined();
  });
});

describe('scrubSecrets — redact credentials before surfacing in errors', () => {
  it('redacts user:pass in a proxy URL', () => {
    expect(scrubSecrets('solve failed via http://user:s3cret@127.0.0.1:7890 now')).toBe(
      'solve failed via http://***@127.0.0.1:7890 now',
    );
  });

  it('leaves a credential-free URL untouched', () => {
    expect(scrubSecrets('http://127.0.0.1:7890 and https://www.hepdata.net/x')).toBe(
      'http://127.0.0.1:7890 and https://www.hepdata.net/x',
    );
  });
});

describe('isAllowedBrowserRequestUrl — SSRF allow-list for in-browser requests', () => {
  it('allows the HEPData data host over https', () => {
    expect(isAllowedBrowserRequestUrl('https://www.hepdata.net/record/1?format=json')).toBe(true);
  });

  it('allows the Cloudflare challenge platform over https', () => {
    expect(isAllowedBrowserRequestUrl('https://challenges.cloudflare.com/turnstile/v0/api.js')).toBe(
      true,
    );
  });

  it('rejects any other host (incl. cloud metadata)', () => {
    expect(isAllowedBrowserRequestUrl('https://evil.example.com/x')).toBe(false);
    expect(isAllowedBrowserRequestUrl('https://169.254.169.254/latest/meta-data')).toBe(false);
    expect(isAllowedBrowserRequestUrl('https://hepdata.net.evil.com/x')).toBe(false);
  });

  it('rejects non-https and unparseable URLs', () => {
    expect(isAllowedBrowserRequestUrl('http://www.hepdata.net/x')).toBe(false);
    expect(isAllowedBrowserRequestUrl('file:///etc/passwd')).toBe(false);
    expect(isAllowedBrowserRequestUrl('not a url')).toBe(false);
  });
});

describe('challengeOptOutError — precise actionable message', () => {
  it('names the challenge, includes cf-ray, and lists all three remedies', () => {
    const headers = new Headers({ 'cf-ray': 'abc123-LHR' });
    const err = challengeOptOutError(URL, headers);
    const msg = (err as Error).message;

    expect(msg).toMatch(/Cloudflare Managed Challenge/i);
    expect(msg).toContain('cf-ray: abc123-LHR');
    expect(msg).toContain(URL);
    // Remedy (a) clean proxy, (b) browser fallback + playwright, (c) clean exit.
    expect(msg).toMatch(/HEPDATA_PROXY|residential proxy/i);
    expect(msg).toMatch(/HEPDATA_BROWSER_FETCH=1/);
    expect(msg).toMatch(/npm i playwright/);
    expect(msg).toMatch(/clean exit IP/i);
  });

  it('omits the cf-ray clause when the header is absent', () => {
    const err = challengeOptOutError(URL, new Headers());
    expect((err as Error).message).not.toContain('cf-ray');
  });
});

describe('selectAndRun — transport selection policy', () => {
  it('challenge + opt-OUT → throws the precise opt-out error; never calls a solver', async () => {
    const { solver, calls } = mockSolver({ status: 200, headers: {}, body: enc('{}') });
    setBrowserSolver(solver);
    // HEPDATA_BROWSER_FETCH is unset (opt-out)

    await expect(selectAndRun(URL, new Headers({ 'cf-ray': 'r1' }))).rejects.toThrow(
      /Cloudflare Managed Challenge/i,
    );
    expect(calls).toHaveLength(0);
  });

  it('challenge + opt-IN → runs the mock solver and returns its raw bytes', async () => {
    process.env.HEPDATA_BROWSER_FETCH = '1';
    const { solver, calls } = mockSolver({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: enc('{"total":1}'),
    });
    setBrowserSolver(solver);

    const result = await selectAndRun(URL, new Headers());
    expect(result.status).toBe(200);
    expect(dec(result.body)).toBe('{"total":1}');
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(URL);
  });

  it('challenge + opt-IN passes the resolved proxy + confined userDataDir + signal to the solver', async () => {
    process.env.HEPDATA_BROWSER_FETCH = '1';
    process.env.HEPDATA_PROXY = 'http://127.0.0.1:7890';
    const { solver, calls } = mockSolver({ status: 200, headers: {}, body: enc('{}') });
    setBrowserSolver(solver);
    const ac = new AbortController();

    await selectAndRun(URL, new Headers(), ac.signal);
    expect(calls[0].opts.proxy).toBe('http://127.0.0.1:7890');
    expect(calls[0].opts.userDataDir).toMatch(/hep-mcp-cf-/);
    expect(calls[0].opts.timeoutMs).toBeGreaterThan(0);
    expect(calls[0].opts.signal).toBe(ac.signal);
  });

  it('does NOT cache here — caching is the rate limiter’s text-safe responsibility', async () => {
    process.env.HEPDATA_BROWSER_FETCH = '1';
    const cache = new UrlCache(8);
    setUrlCache(cache);
    const { solver } = mockSolver({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: enc('{"v":1}'),
    });
    setBrowserSolver(solver);

    await selectAndRun(URL, new Headers());
    // selectAndRun no longer writes the cache (the limiter does, under its gate).
    expect(cache.size).toBe(0);
  });

  it('challenge + opt-IN + playwright import FAILS → precise "npm i playwright" error', async () => {
    process.env.HEPDATA_BROWSER_FETCH = '1';
    // Use the REAL PlaywrightSolver but force its dynamic import to fail.
    setBrowserSolver(new PlaywrightSolver());
    setPlaywrightImporter(async () => {
      throw new Error("Cannot find module 'playwright'");
    });

    await expect(selectAndRun(URL, new Headers())).rejects.toThrow(/npm i playwright/);
  });

  it('wraps an unexpected solver error in an upstream error mentioning the URL', async () => {
    process.env.HEPDATA_BROWSER_FETCH = '1';
    setBrowserSolver({
      async solve() {
        throw new Error('chromium crashed');
      },
    });

    await expect(selectAndRun(URL, new Headers())).rejects.toThrow(/chromium crashed/);
    await expect(selectAndRun(URL, new Headers())).rejects.toThrow(/Browser transport failed/);
  });

  it('scrubs proxy credentials out of a wrapped solver error', async () => {
    process.env.HEPDATA_BROWSER_FETCH = '1';
    setBrowserSolver({
      async solve() {
        throw new Error('connect failed to http://user:s3cret@127.0.0.1:7890');
      },
    });

    const err = await selectAndRun(URL, new Headers()).then(
      () => {
        throw new Error('expected rejection');
      },
      (e: unknown) => e as Error,
    );
    expect(err.message).toContain('http://***@127.0.0.1:7890');
    expect(err.message).not.toContain('s3cret');
  });
});

describe('PlaywrightSolver — host assertion (no real browser launched)', () => {
  it('rejects a non-hepdata host before importing playwright', async () => {
    const solver = new PlaywrightSolver();
    // Importer would throw if reached; host assert must fire first.
    setPlaywrightImporter(async () => {
      throw new Error('import should not be reached');
    });
    await expect(
      solver.solve('https://evil.example.com/x', {
        userDataDir: '/tmp/x',
        timeoutMs: 1000,
      }),
    ).rejects.toThrow(/host not in allow-list/);
  });

  it('rejects an http:// (non-https) hepdata URL', async () => {
    const solver = new PlaywrightSolver();
    await expect(
      solver.solve('http://www.hepdata.net/x', { userDataDir: '/tmp/x', timeoutMs: 1000 }),
    ).rejects.toThrow(/non-https scheme/);
  });

  it('surfaces PlaywrightUnavailableError when the import fails for a valid host', async () => {
    const solver = new PlaywrightSolver();
    setPlaywrightImporter(async () => {
      throw new Error("Cannot find module 'playwright'");
    });
    await expect(
      solver.solve(URL, { userDataDir: '/tmp/x', timeoutMs: 1000 }),
    ).rejects.toBeInstanceOf(PlaywrightUnavailableError);
  });
});

describe('fetchRawFollowingRedirects — manual, host-validated redirect following', () => {
  const HEP = 'https://www.hepdata.net';
  const deadline = (): number => Date.now() + 60_000;

  function mockApiResponse(opts: {
    status: number;
    headers?: Record<string, string>;
    body?: Uint8Array;
  }): RawApiResponse {
    return {
      status: () => opts.status,
      headers: () => opts.headers ?? {},
      body: async () => opts.body ?? new Uint8Array(),
    };
  }

  function queueGetter(responses: RawApiResponse[]): { getter: RawGetter; urls: string[] } {
    const urls: string[] = [];
    let i = 0;
    const getter: RawGetter = async (url) => {
      urls.push(url);
      const r = responses[i++];
      if (!r) throw new Error('queueGetter: no more mock responses');
      return r;
    };
    return { getter, urls };
  }

  it('returns raw bytes + status + headers for a direct 200', async () => {
    const { getter, urls } = queueGetter([
      mockApiResponse({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: enc('{"ok":1}'),
      }),
    ]);
    const res = await fetchRawFollowingRedirects(getter, `${HEP}/record/1?format=json`, deadline());
    expect(res.status).toBe(200);
    expect(dec(res.body)).toBe('{"ok":1}');
    expect(res.headers['content-type']).toBe('application/json');
    expect(urls).toEqual([`${HEP}/record/1?format=json`]);
  });

  it('follows a same-host redirect and returns the final response', async () => {
    const { getter, urls } = queueGetter([
      mockApiResponse({ status: 302, headers: { location: `${HEP}/download/x/final` } }),
      mockApiResponse({ status: 200, body: enc('DATA') }),
    ]);
    const res = await fetchRawFollowingRedirects(getter, `${HEP}/download/x`, deadline());
    expect(dec(res.body)).toBe('DATA');
    expect(urls).toEqual([`${HEP}/download/x`, `${HEP}/download/x/final`]);
  });

  it('BLOCKS a redirect to a disallowed host (SSRF) before issuing the next request', async () => {
    const { getter, urls } = queueGetter([
      mockApiResponse({ status: 302, headers: { location: 'https://169.254.169.254/latest/meta-data' } }),
      mockApiResponse({ status: 200, body: enc('SHOULD-NOT-REACH') }),
    ]);
    await expect(
      fetchRawFollowingRedirects(getter, `${HEP}/download/x`, deadline()),
    ).rejects.toThrow(/host not in allow-list/);
    // The metadata host was never requested.
    expect(urls).toEqual([`${HEP}/download/x`]);
  });

  it('blocks a redirect to a non-https target (downgrade)', async () => {
    const { getter } = queueGetter([
      mockApiResponse({ status: 301, headers: { location: 'http://www.hepdata.net/x' } }),
    ]);
    await expect(fetchRawFollowingRedirects(getter, `${HEP}/x`, deadline())).rejects.toThrow(
      /non-https scheme/,
    );
  });

  it('throws on a redirect without a Location header', async () => {
    const { getter } = queueGetter([mockApiResponse({ status: 302, headers: {} })]);
    await expect(fetchRawFollowingRedirects(getter, `${HEP}/x`, deadline())).rejects.toThrow(
      /missing Location/,
    );
  });

  it('throws after exceeding the redirect budget', async () => {
    const loop: RawGetter = async () =>
      mockApiResponse({ status: 302, headers: { location: `${HEP}/next` } });
    await expect(
      fetchRawFollowingRedirects(loop, `${HEP}/start`, deadline(), 3),
    ).rejects.toThrow(/too many redirects/);
  });

  it('does NOT treat 304 Not Modified as a redirect (returns it as-is)', async () => {
    const { getter, urls } = queueGetter([mockApiResponse({ status: 304, headers: {} })]);
    const res = await fetchRawFollowingRedirects(getter, `${HEP}/record/1?format=json`, deadline());
    expect(res.status).toBe(304);
    expect(urls).toHaveLength(1); // no Location lookup, no extra hop
  });
});
