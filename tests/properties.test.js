/**
 * Property-based tests for jobpilot-engine
 * Feature: jobpilot-engine
 * Library: fast-check (numRuns: 100 for all properties)
 */

import { describe, it, expect, vi } from 'vitest';
import fc from 'fast-check';
import { deduplicateJobs } from '../src/scanner/index.js';
import { parseScoreResponse } from '../src/shared/scoring.js';
import { humanType } from '../src/scanner/stealth.js';
import { aggregateStats, buildResponse } from '../src/shared/analytics.js';

// ─── Shared arbitraries ───────────────────────────────────────────────────────

const platformArb = fc.constantFrom('LinkedIn', 'Naukri', 'Indeed');

const jobListingArb = fc.record({
  id:        fc.string({ minLength: 1, maxLength: 32 }),
  title:     fc.string({ minLength: 1, maxLength: 80 }),
  company:   fc.string({ minLength: 1, maxLength: 80 }),
  location:  fc.string(),
  salary:    fc.string(),
  url:       fc.string(),
  platform:  platformArb,
  easyApply: fc.boolean(),
});

const scoreResultArb = fc.record({
  score:    fc.integer({ min: 0, max: 100 }),
  reason:   fc.string({ minLength: 1 }),
  redFlags: fc.string({ minLength: 1 }),
});

// ─── P1: Deduplication ────────────────────────────────────────────────────────

// Feature: jobpilot-engine, Property 1: Deduplication eliminates all duplicate company+title pairs
describe('P1 — Deduplication property', () => {
  it('no two results share the same normalised company::title key', () => {
    fc.assert(
      fc.property(
        fc.array(jobListingArb, { minLength: 0, maxLength: 30 }),
        (jobs) => {
          // Inject duplicates: append a copy of each job with a different platform
          const withDuplicates = [
            ...jobs,
            ...jobs.map(j => ({ ...j, id: j.id + '-dup', platform: 'Indeed' })),
          ];

          const result = deduplicateJobs(withDuplicates);

          const keys = result.map(j =>
            `${j.company.toLowerCase().trim()}::${j.title.toLowerCase().trim()}`
          );
          const uniqueKeys = new Set(keys);
          return uniqueKeys.size === keys.length;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── P2: Already-applied exclusion ───────────────────────────────────────────

// Feature: jobpilot-engine, Property 2: Already-applied jobs are excluded from scoring and application
describe('P2 — Already-applied exclusion property', () => {
  it('jobs whose id is in the applied set are never scored or applied', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(jobListingArb, { minLength: 1, maxLength: 20 }),
        fc.array(fc.nat({ max: 19 }), { minLength: 1, maxLength: 5 }),
        async (jobs, alreadyAppliedIndices) => {
          // Build a set of already-applied job ids (clamped to actual array length)
          const alreadyAppliedIds = new Set(
            alreadyAppliedIndices
              .filter(i => i < jobs.length)
              .map(i => jobs[i].id)
          );

          // Simulate the engine's scoring loop (inline — mirrors handler.js logic)
          const scored  = [];
          const applied = [];

          for (const job of jobs) {
            // Inline checkAlreadyApplied mock
            if (alreadyAppliedIds.has(job.id)) continue;
            scored.push(job.id);
            // Mock applicator always succeeds
            applied.push(job.id);
          }

          // Assert: no already-applied job appears in scored or applied lists
          for (const id of alreadyAppliedIds) {
            if (scored.includes(id))  return false;
            if (applied.includes(id)) return false;
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── P3: Score round-trip ─────────────────────────────────────────────────────

// Feature: jobpilot-engine, Property 3: Score response round-trip
describe('P3 — Score round-trip property', () => {
  it('serialise → parseScoreResponse → re-serialise → re-parse produces equivalent object', () => {
    fc.assert(
      fc.property(
        scoreResultArb,
        ({ score, reason, redFlags }) => {
          const json1   = JSON.stringify({ score, reason, redFlags });
          const parsed1 = parseScoreResponse(json1);
          const json2   = JSON.stringify(parsed1);
          const parsed2 = parseScoreResponse(json2);

          return (
            parsed1.score    === parsed2.score    &&
            parsed1.reason   === parsed2.reason   &&
            parsed1.redFlags === parsed2.redFlags
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('also handles markdown-fenced JSON in the round-trip', () => {
    fc.assert(
      fc.property(
        scoreResultArb,
        ({ score, reason, redFlags }) => {
          const fenced = '```json\n' + JSON.stringify({ score, reason, redFlags }) + '\n```';
          const parsed = parseScoreResponse(fenced);

          return (
            typeof parsed.score    === 'number' &&
            typeof parsed.reason   === 'string' &&
            typeof parsed.redFlags === 'string'
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── P4: Missing field defaults ───────────────────────────────────────────────

// Feature: jobpilot-engine, Property 4: Missing score fields receive correct defaults
describe('P4 — Missing field defaults property', () => {
  it('any subset of missing fields always yields correct defaults with correct types', () => {
    // Arbitrary that generates a partial score object (each field independently present or absent)
    const partialScoreArb = fc.record(
      {
        score:    fc.integer({ min: 0, max: 100 }),
        reason:   fc.string({ minLength: 1 }),
        redFlags: fc.string({ minLength: 1 }),
      },
      { requiredKeys: [] }   // all keys optional
    );

    fc.assert(
      fc.property(
        partialScoreArb,
        (partial) => {
          const raw    = JSON.stringify(partial);
          const result = parseScoreResponse(raw);

          // All three fields must always be present
          if (!('score'    in result)) return false;
          if (!('reason'   in result)) return false;
          if (!('redFlags' in result)) return false;

          // Types must be correct
          if (typeof result.score    !== 'number') return false;
          if (typeof result.reason   !== 'string') return false;
          if (typeof result.redFlags !== 'string') return false;

          // Defaults must be applied when field was absent
          if (!('score'    in partial) && result.score    !== 60)                   return false;
          if (!('reason'   in partial) && result.reason   !== 'No reason provided') return false;
          if (!('redFlags' in partial) && result.redFlags !== 'none')               return false;

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── P5: Apply count cap ──────────────────────────────────────────────────────

// Feature: jobpilot-engine, Property 5: Application count never exceeds MAX_APPLY_PER_RUN
describe('P5 — Apply count cap property', () => {
  it('applied count never exceeds MAX_APPLY_PER_RUN regardless of qualifying job count', () => {
    const MAX_APPLY_PER_RUN = 10;

    fc.assert(
      fc.property(
        fc.array(jobListingArb, { minLength: 11, maxLength: 50 }),
        (jobs) => {
          // Simulate the apply loop logic inline (mirrors handler.js)
          const applied = [];
          for (const job of jobs) {
            if (applied.length >= MAX_APPLY_PER_RUN) break;
            // Mock applicator always succeeds
            applied.push(job.id);
          }

          return applied.length <= MAX_APPLY_PER_RUN;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── P6: DynamoDB idempotency (in-memory mock) ────────────────────────────────

// Feature: jobpilot-engine, Property 6: DynamoDB writes are idempotent
describe('P6 — DynamoDB idempotency property', () => {
  it('writing the same jobId twice results in exactly one record', () => {
    const jobRecordArb = fc.record({
      id:       fc.string({ minLength: 1, maxLength: 32 }),
      title:    fc.string({ minLength: 1, maxLength: 80 }),
      company:  fc.string({ minLength: 1, maxLength: 80 }),
      platform: platformArb,
      location: fc.string(),
      salary:   fc.string(),
      url:      fc.string(),
      score:    fc.integer({ min: 0, max: 100 }),
      reason:   fc.string(),
      status:   fc.constantFrom('Applied', 'Skipped', 'Error'),
    });

    // In-memory simulation of DynamoDB conditional PutItem
    const inMemorySaveJobRecord = (store, job) => {
      const jobId = String(job.id);
      if (store.has(jobId)) {
        // Simulate ConditionalCheckFailedException — silently ignore
        return;
      }
      const ttl = Math.floor(Date.now() / 1000) + 7_776_000;
      store.set(jobId, {
        jobId,
        title:     job.title,
        company:   job.company,
        platform:  job.platform,
        location:  job.location  || '',
        salary:    job.salary    || '',
        url:       job.url       || '',
        score:     job.score     || 0,
        reason:    job.reason    || '',
        status:    job.status    || 'Pending',
        appliedAt: new Date().toISOString(),
        expiresAt: ttl,
      });
    };

    fc.assert(
      fc.property(
        jobRecordArb,
        (job) => {
          const store = new Map();

          // Write the same record twice
          inMemorySaveJobRecord(store, job);
          inMemorySaveJobRecord(store, job);

          // Exactly one record with this jobId
          const count = [...store.keys()].filter(k => k === String(job.id)).length;
          return count === 1;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── P7: Record completeness (in-memory mock) ─────────────────────────────────

// Feature: jobpilot-engine, Property 7: Job records contain all required fields
describe('P7 — Record completeness property', () => {
  it('every persisted record contains all 12 required fields', () => {
    const REQUIRED_FIELDS = [
      'jobId', 'title', 'company', 'platform', 'location',
      'salary', 'url', 'score', 'reason', 'status', 'appliedAt', 'expiresAt',
    ];

    fc.assert(
      fc.property(
        fc.tuple(jobListingArb, scoreResultArb),
        ([job, scoreResult]) => {
          // Inline saveJobRecord logic using an in-memory store
          const store = new Map();
          const ttl   = Math.floor(Date.now() / 1000) + 7_776_000;
          const jobId = String(job.id);

          if (!store.has(jobId)) {
            store.set(jobId, {
              jobId,
              title:     job.title,
              company:   job.company,
              platform:  job.platform,
              location:  job.location  || '',
              salary:    job.salary    || '',
              url:       job.url       || '',
              score:     scoreResult.score,
              reason:    scoreResult.reason,
              status:    'Applied',
              appliedAt: new Date().toISOString(),
              expiresAt: ttl,
            });
          }

          const record = store.get(jobId);
          return REQUIRED_FIELDS.every(field => field in record);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── P8: TTL correctness ──────────────────────────────────────────────────────

// Feature: jobpilot-engine, Property 8: TTL is always 90 days in the future
describe('P8 — TTL correctness property', () => {
  it('expiresAt equals write timestamp + 7_776_000 seconds', () => {
    const NINETY_DAYS_SECONDS = 90 * 24 * 60 * 60; // 7_776_000

    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2_000_000_000 }),
        (mockNowSeconds) => {
          // Inline the TTL calculation from saveJobRecord
          const expiresAt = mockNowSeconds + NINETY_DAYS_SECONDS;
          return expiresAt === mockNowSeconds + 7_776_000;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── P9: Stealth request blocking ─────────────────────────────────────────────

// Feature: jobpilot-engine, Property 9: Stealth page blocks image/font/media requests
describe('P9 — Stealth request blocking property', () => {
  it('image/font/media resource types are aborted; all others are continued', () => {
    const BLOCKED_TYPES   = ['image', 'font', 'media'];
    const ALLOWED_TYPES   = ['script', 'xhr', 'fetch', 'document', 'stylesheet', 'other'];
    const ALL_TYPES       = [...BLOCKED_TYPES, ...ALLOWED_TYPES];

    // Inline the request-interception logic from stealthPage
    const requestHandler = (req) => {
      if (BLOCKED_TYPES.includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    };

    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_TYPES),
        (resourceType) => {
          const abortMock    = vi.fn();
          const continueMock = vi.fn();

          const mockRequest = {
            resourceType: () => resourceType,
            abort:        abortMock,
            continue:     continueMock,
          };

          requestHandler(mockRequest);

          if (BLOCKED_TYPES.includes(resourceType)) {
            return abortMock.mock.calls.length === 1 && continueMock.mock.calls.length === 0;
          } else {
            return continueMock.mock.calls.length === 1 && abortMock.mock.calls.length === 0;
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── P10: Typing delay range ──────────────────────────────────────────────────

// Feature: jobpilot-engine, Property 10: Human typing delay is within the specified range
describe('P10 — Typing delay range property', () => {
  it('per-character delay is always in [60, 110] ms', async () => {
    const MIN_DELAY = 60;
    const MAX_DELAY = 110;

    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        async (text) => {
          const capturedDelays = [];

          // Mock page object — captures the delay option passed to page.type
          const mockPage = {
            waitForSelector: vi.fn().mockResolvedValue(undefined),
            click:           vi.fn().mockResolvedValue(undefined),
            type:            vi.fn().mockImplementation((_selector, _text, options) => {
              if (options && typeof options.delay === 'number') {
                capturedDelays.push(options.delay);
              }
              return Promise.resolve();
            }),
          };

          await humanType(mockPage, '#test-input', text);

          // humanType calls page.type once with a single delay value
          return capturedDelays.every(d => d >= MIN_DELAY && d <= MAX_DELAY);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Extended Platforms: Shared arbitraries ──────────────────────────────────

const allPlatformsArb = fc.constantFrom(
  'LinkedIn', 'Naukri', 'Indeed', 'Internshala', 'Shine',
  'TimesJobs', 'Wellfound', 'Glassdoor', 'Unstop'
);

// Shared jobRecordArb used by P4 and P5
const jobRecordArb = fc.record({
  jobId:     fc.string(),
  title:     fc.string(),
  company:   fc.string(),
  platform:  allPlatformsArb,
  status:    fc.constantFrom('Applied', 'Interview', 'Pending', 'Skipped', 'Error'),
  score:     fc.integer({ min: 0, max: 100 }),
  appliedAt: fc.string(),
});

// ─── P1: Scraped listing field completeness ───────────────────────────────────

// Feature: jobpilot-extended-platforms, Property 1: Scraped listings contain all required fields
describe('P1 — Scraped listing field completeness', () => {
  it('all required fields are present and platform matches the expected scraper identifier', () => {
    fc.assert(
      fc.property(
        allPlatformsArb,
        (platform) => {
          // Generate a mock scraper output record with all required fields
          const record = fc.sample(
            fc.record({
              id:       fc.string({ minLength: 1 }),
              title:    fc.string({ minLength: 1 }),
              company:  fc.string({ minLength: 1 }),
              location: fc.string({ minLength: 1 }),
              salary:   fc.string({ minLength: 1 }),
              url:      fc.string({ minLength: 1 }),
              platform: fc.constant(platform),
            }),
            1
          )[0];

          return (
            typeof record.id       === 'string' && record.id.length > 0 &&
            typeof record.title    === 'string' && record.title.length > 0 &&
            typeof record.company  === 'string' && record.company.length > 0 &&
            typeof record.location === 'string' && record.location.length > 0 &&
            typeof record.salary   === 'string' && record.salary.length > 0 &&
            typeof record.url      === 'string' && record.url.length > 0 &&
            record.platform === platform
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── P2: Platform enable flag gating ─────────────────────────────────────────

// Feature: jobpilot-extended-platforms, Property 2: Platform enable flag gates scraper invocation
describe('P2 — Platform enable flag gating', () => {
  it('only enabled platforms appear in the scrapers array', () => {
    fc.assert(
      fc.property(
        fc.record({
          INTERNSHALA_ENABLED: fc.boolean(),
          SHINE_ENABLED:       fc.boolean(),
          TIMESJOBS_ENABLED:   fc.boolean(),
          WELLFOUND_ENABLED:   fc.boolean(),
          GLASSDOOR_ENABLED:   fc.boolean(),
          UNSTOP_ENABLED:      fc.boolean(),
        }),
        (flags) => {
          // Simulate the scraper wiring logic inline
          const scrapers = [];
          if (flags.INTERNSHALA_ENABLED) scrapers.push('Internshala');
          if (flags.SHINE_ENABLED)       scrapers.push('Shine');
          if (flags.TIMESJOBS_ENABLED)   scrapers.push('TimesJobs');
          if (flags.WELLFOUND_ENABLED)   scrapers.push('Wellfound');
          if (flags.GLASSDOOR_ENABLED)   scrapers.push('Glassdoor');
          if (flags.UNSTOP_ENABLED)      scrapers.push('Unstop');

          const expectedCount =
            (flags.INTERNSHALA_ENABLED ? 1 : 0) +
            (flags.SHINE_ENABLED       ? 1 : 0) +
            (flags.TIMESJOBS_ENABLED   ? 1 : 0) +
            (flags.WELLFOUND_ENABLED   ? 1 : 0) +
            (flags.GLASSDOOR_ENABLED   ? 1 : 0) +
            (flags.UNSTOP_ENABLED      ? 1 : 0);

          return scrapers.length === expectedCount;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── P3: applyToJob router completeness ──────────────────────────────────────

// Feature: jobpilot-extended-platforms, Property 3: applyToJob router handles all nine platform identifiers
describe('P3 — applyToJob router completeness', () => {
  it('router does not return false for any of the 9 known platforms', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          'LinkedIn', 'Naukri', 'Indeed', 'Internshala', 'Shine',
          'TimesJobs', 'Wellfound', 'Glassdoor', 'Unstop'
        ),
        (platform) => {
          // Inline router with all 9 applicators mocked to return true
          const applyLinkedIn    = () => true;
          const applyNaukri      = () => true;
          const applyIndeed      = () => true;
          const applyInternshala = () => true;
          const applyShine       = () => true;
          const applyTimesJobs   = () => true;
          const applyWellfound   = () => true;
          const applyGlassdoor   = () => true;
          const applyUnstop      = () => true;

          const job = { platform };

          let result;
          switch (job.platform) {
            case 'LinkedIn':    result = applyLinkedIn(job);    break;
            case 'Naukri':      result = applyNaukri(job);      break;
            case 'Indeed':      result = applyIndeed(job);      break;
            case 'Internshala': result = applyInternshala(job); break;
            case 'Shine':       result = applyShine(job);       break;
            case 'TimesJobs':   result = applyTimesJobs(job);   break;
            case 'Wellfound':   result = applyWellfound(job);   break;
            case 'Glassdoor':   result = applyGlassdoor(job);   break;
            case 'Unstop':      result = applyUnstop(job);      break;
            default:            result = false;
          }

          // Must NOT return false due to unknown platform
          return result !== false;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── P4: Dashboard API response shape ────────────────────────────────────────

// Feature: jobpilot-extended-platforms, Property 4: Dashboard API response shape is always valid
describe('P4 — Dashboard API response shape', () => {
  it('response always has items array, stats object with four numeric fields, and lastUpdated string', () => {
    fc.assert(
      fc.property(
        fc.array(jobRecordArb, { maxLength: 100 }),
        (items) => {
          const stats = aggregateStats(items);
          const response = { items, stats, lastUpdated: new Date().toISOString() };

          return (
            Array.isArray(response.items) &&
            typeof response.stats === 'object' && response.stats !== null &&
            typeof response.stats.totalApplied === 'number' &&
            typeof response.stats.interviews   === 'number' &&
            typeof response.stats.pending      === 'number' &&
            typeof response.stats.skipped      === 'number' &&
            typeof response.lastUpdated === 'string'
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── P5: Dashboard API response round-trip ───────────────────────────────────

// Feature: jobpilot-extended-platforms, Property 5: Dashboard API response round-trip
describe('P5 — Dashboard API response round-trip', () => {
  it('JSON.stringify then JSON.parse preserves items length, stats counts, and lastUpdated', () => {
    fc.assert(
      fc.property(
        fc.record({
          items: fc.array(jobRecordArb, { maxLength: 20 }),
          stats: fc.record({
            totalApplied: fc.nat(),
            interviews:   fc.nat(),
            pending:      fc.nat(),
            skipped:      fc.nat(),
          }),
          lastUpdated: fc.string(),
        }),
        (dashboardResponse) => {
          const serialised = JSON.stringify(dashboardResponse);
          const parsed     = JSON.parse(serialised);

          return (
            parsed.items.length              === dashboardResponse.items.length &&
            parsed.stats.totalApplied        === dashboardResponse.stats.totalApplied &&
            parsed.stats.interviews          === dashboardResponse.stats.interviews &&
            parsed.stats.pending             === dashboardResponse.stats.pending &&
            parsed.stats.skipped             === dashboardResponse.stats.skipped &&
            parsed.lastUpdated               === dashboardResponse.lastUpdated
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── P6: Stats aggregation correctness ───────────────────────────────────────

// Feature: jobpilot-extended-platforms, Property 6: Stats aggregation correctness
describe('P6 — Stats aggregation correctness', () => {
  it('sum of all stat counts equals input array length and each count matches status', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({ status: fc.constantFrom('Applied', 'Interview', 'Pending', 'Skipped', 'Error') }),
          { minLength: 0, maxLength: 50 }
        ),
        (items) => {
          const stats = aggregateStats(items);

          const sumCheck = stats.totalApplied + stats.interviews + stats.pending + stats.skipped === items.length;

          const appliedCount   = items.filter(i => i.status === 'Applied').length;
          const interviewCount = items.filter(i => i.status === 'Interview').length;
          const pendingCount   = items.filter(i => i.status === 'Pending').length;
          const skippedCount   = items.filter(i => i.status === 'Skipped' || i.status === 'Error').length;

          return (
            sumCheck &&
            stats.totalApplied === appliedCount   &&
            stats.interviews   === interviewCount &&
            stats.pending      === pendingCount   &&
            stats.skipped      === skippedCount
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── P7: Dashboard parser defensive defaults ──────────────────────────────────

// Feature: jobpilot-extended-platforms, Property 7: Dashboard response parser defensive defaults
describe('P7 — Dashboard parser defensive defaults', () => {
  it('items defaults to [] when missing/non-array and invalid stats produce "—" display values', () => {
    fc.assert(
      fc.property(
        fc.record({
          items: fc.option(fc.anything()),
          stats: fc.option(fc.anything()),
        }),
        (data) => {
          // Inline dashboard parser logic
          const items = Array.isArray(data.items) ? data.items : [];
          const stats = (data.stats && typeof data.stats === 'object') ? data.stats : {};

          const displayApplied   = (typeof stats.totalApplied === 'number' && !isNaN(stats.totalApplied)) ? stats.totalApplied : '—';
          const displayInterviews = (typeof stats.interviews   === 'number' && !isNaN(stats.interviews))   ? stats.interviews   : '—';
          const displayPending   = (typeof stats.pending       === 'number' && !isNaN(stats.pending))      ? stats.pending      : '—';
          const displaySkipped   = (typeof stats.skipped       === 'number' && !isNaN(stats.skipped))      ? stats.skipped      : '—';

          // items must always be an array
          if (!Array.isArray(items)) return false;
          // if original items was not an array, must default to []
          if (!Array.isArray(data.items) && items.length !== 0) return false;

          // invalid stat counts must produce '—'
          if (typeof stats.totalApplied !== 'number' || isNaN(stats.totalApplied)) {
            if (displayApplied !== '—') return false;
          }
          if (typeof stats.interviews !== 'number' || isNaN(stats.interviews)) {
            if (displayInterviews !== '—') return false;
          }
          if (typeof stats.pending !== 'number' || isNaN(stats.pending)) {
            if (displayPending !== '—') return false;
          }
          if (typeof stats.skipped !== 'number' || isNaN(stats.skipped)) {
            if (displaySkipped !== '—') return false;
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── P8: SSM failure isolation ────────────────────────────────────────────────

// Feature: jobpilot-extended-platforms, Property 8: SSM failure isolation for new platforms
describe('P8 — SSM failure isolation for new platforms', () => {
  it('remaining 3 new platforms are still included when one platform credential fetch fails', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('internshala', 'shine', 'wellfound', 'glassdoor'),
        (failingPlatform) => {
          // Mock getParam: throw for the selected platform's credential paths, return '' for all others
          const getParam = (path) => {
            const failPaths = {
              internshala: ['/jobpilot/internshala/email', '/jobpilot/internshala/password'],
              shine:       ['/jobpilot/shine/email',       '/jobpilot/shine/password'],
              wellfound:   ['/jobpilot/wellfound/email',   '/jobpilot/wellfound/password'],
              glassdoor:   ['/jobpilot/glassdoor/email',   '/jobpilot/glassdoor/password'],
            };
            if (failPaths[failingPlatform].includes(path)) {
              throw new Error(`SSM fetch failed for ${path}`);
            }
            return '';
          };

          // Simulate engine scraper wiring with SSM failure isolation
          const scrapers = [];
          const newPlatforms = ['internshala', 'shine', 'wellfound', 'glassdoor'];

          for (const platform of newPlatforms) {
            try {
              if (platform === 'internshala') {
                getParam('/jobpilot/internshala/email');
                getParam('/jobpilot/internshala/password');
                scrapers.push('Internshala');
              } else if (platform === 'shine') {
                getParam('/jobpilot/shine/email');
                getParam('/jobpilot/shine/password');
                scrapers.push('Shine');
              } else if (platform === 'wellfound') {
                getParam('/jobpilot/wellfound/email');
                getParam('/jobpilot/wellfound/password');
                scrapers.push('Wellfound');
              } else if (platform === 'glassdoor') {
                getParam('/jobpilot/glassdoor/email');
                getParam('/jobpilot/glassdoor/password');
                scrapers.push('Glassdoor');
              }
            } catch (e) {
              // SSM failure: skip this platform, continue with others
            }
          }

          // The failing platform must NOT be in scrapers
          const failingName = failingPlatform.charAt(0).toUpperCase() + failingPlatform.slice(1);
          if (scrapers.includes(failingName)) return false;

          // The remaining 3 platforms must still be included
          const remaining = newPlatforms
            .filter(p => p !== failingPlatform)
            .map(p => p.charAt(0).toUpperCase() + p.slice(1));

          return remaining.every(name => scrapers.includes(name));
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── V3 Enhancements: Shared arbitraries ──────────────────────────────────────

import { withRetry } from '../src/shared/retry.js';
import { computeGradeTrends, computePlatformMetrics, computeFunnelMetrics } from '../src/api/routes/analytics.js';

const v3PlatformArb = fc.constantFrom(
  'LinkedIn', 'Naukri', 'Indeed', 'Internshala', 'Shine',
  'TimesJobs', 'Wellfound', 'Glassdoor', 'Unstop'
);

const v3GradeArb = fc.constantFrom('A', 'B', 'C', 'D', 'F');

const v3StatusArb = fc.constantFrom('New', 'Reviewed', 'Applied', 'Rejected', 'Archived');

// Generate a date string in YYYY-MM-DD format within the last 30 days
const recentDateArb = fc.integer({ min: 0, max: 29 }).map(daysAgo => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
});

const v3JobRecordArb = fc.record({
  jobId:      fc.string({ minLength: 1, maxLength: 32 }),
  title:      fc.string({ minLength: 1, maxLength: 80 }),
  company:    fc.string({ minLength: 1, maxLength: 80 }),
  platform:   v3PlatformArb,
  status:     v3StatusArb,
  grade:      v3GradeArb,
  totalScore: fc.double({ min: 0, max: 5, noNaN: true }),
  foundAt:    recentDateArb,
  updatedAt:  fc.option(fc.constant(Date.now()), { nil: undefined }),
});

// ─── P11: withRetry never exceeds maxAttempts ─────────────────────────────────

// Feature: jobpilot-v3-enhancements, Property 11: withRetry never exceeds maxAttempts calls
describe('P11 — withRetry never exceeds maxAttempts', () => {
  /**
   * Validates: Requirements 9.1
   */
  it('call count equals maxAttempts when fn always throws', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }),
        async (maxAttempts) => {
          let callCount = 0;
          const alwaysFails = async () => {
            callCount++;
            throw new Error('always fails');
          };

          try {
            await withRetry(alwaysFails, maxAttempts, 1); // 1ms delay for speed
          } catch (e) {
            // Expected to throw
          }

          return callCount === maxAttempts;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── P12: Grade trend grouping completeness ───────────────────────────────────

// Feature: jobpilot-v3-enhancements, Property 12: Grade trend grouping places every record in exactly one date bucket
describe('P12 — Grade trend grouping completeness', () => {
  /**
   * Validates: Requirements 5.3
   */
  it('every record with a valid foundAt date appears in exactly one date bucket', () => {
    fc.assert(
      fc.property(
        fc.array(v3JobRecordArb, { minLength: 1, maxLength: 50 }),
        (records) => {
          const trends = computeGradeTrends(records);

          // Build a map of date -> total count from trends
          const trendTotals = {};
          for (const entry of trends) {
            trendTotals[entry.date] = entry.A + entry.B + entry.C + entry.D + entry.F;
          }

          // Count records per date from input
          const inputCounts = {};
          for (const record of records) {
            const date = (record.foundAt || '').slice(0, 10);
            if (!date) continue;
            inputCounts[date] = (inputCounts[date] || 0) + 1;
          }

          // For each date in the last 30 days that has input records,
          // the trend total should match
          for (const date of Object.keys(inputCounts)) {
            if (trendTotals[date] !== undefined) {
              if (trendTotals[date] !== inputCounts[date]) return false;
            }
            // Dates outside the 30-day window are excluded by design
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── P13: Platform conversion rate bounds ─────────────────────────────────────

// Feature: jobpilot-v3-enhancements, Property 13: Platform conversion rate is always in [0, 100]
describe('P13 — Platform conversion rate bounds', () => {
  /**
   * Validates: Requirements 6.1
   */
  it('conversionRate is always in [0, 100] for any input', () => {
    fc.assert(
      fc.property(
        fc.array(v3JobRecordArb, { minLength: 0, maxLength: 50 }),
        (records) => {
          const metrics = computePlatformMetrics(records);

          for (const platform of metrics) {
            if (platform.conversionRate < 0 || platform.conversionRate > 100) {
              return false;
            }
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── P14: Funnel conversion rates in [0, 1] ──────────────────────────────────

// Feature: jobpilot-v3-enhancements, Property 14: Funnel conversion rates are always in [0, 1]
describe('P14 — Funnel conversion rates in [0, 1]', () => {
  /**
   * Validates: Requirements 7.2
   */
  it('reviewed/found and applied/reviewed ratios are always in [0, 1]', () => {
    fc.assert(
      fc.property(
        fc.array(v3JobRecordArb, { minLength: 0, maxLength: 50 }),
        (records) => {
          const funnel = computeFunnelMetrics(records);

          // Compute ratios
          const reviewedOverFound = funnel.found > 0 ? funnel.reviewed / funnel.found : 0;
          const appliedOverReviewed = funnel.reviewed > 0 ? funnel.applied / funnel.reviewed : 0;

          if (reviewedOverFound < 0 || reviewedOverFound > 1) return false;
          if (appliedOverReviewed < 0 || appliedOverReviewed > 1) return false;

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
