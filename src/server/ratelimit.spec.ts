process.env.DATABASE_URL ||= "postgresql://x";
process.env.DIRECT_DATABASE_URL ||= "postgresql://x";
process.env.JWT_SECRET ||= "x".repeat(40);
process.env.STORAGE_ENCRYPTION_KEY ||= Buffer.alloc(32, 1).toString("base64");

type Row = { bucket: string; windowStart: number; count: number };
const store = new Map<string, Row>();

jest.mock("@/server/db", () => ({
  db: {
    rateLimitHit: {
      upsert: jest.fn(async ({ where, create, update }: any) => {
        const k = `${where.bucket_windowStart.bucket}@${where.bucket_windowStart.windowStart.getTime()}`;
        const existing = store.get(k);
        if (existing) {
          existing.count += update.count.increment;
          return existing;
        }
        const row: Row = {
          bucket: create.bucket,
          windowStart: create.windowStart.getTime(),
          count: create.count,
        };
        store.set(k, row);
        return row;
      }),
      deleteMany: jest.fn(async () => ({ count: 0 })),
    },
  },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { enforceRateLimit } = require("./ratelimit");

beforeEach(() => store.clear());

describe("enforceRateLimit", () => {
  it("allows requests up to the limit, then throws 429", async () => {
    const rule = { limit: 3, windowMs: 60_000 };
    await enforceRateLimit("login:1.2.3.4", rule);
    await enforceRateLimit("login:1.2.3.4", rule);
    await enforceRateLimit("login:1.2.3.4", rule);
    await expect(enforceRateLimit("login:1.2.3.4", rule)).rejects.toMatchObject({ status: 429 });
  });

  it("keeps separate counters per bucket", async () => {
    const rule = { limit: 1, windowMs: 60_000 };
    await enforceRateLimit("login:a", rule);
    await expect(enforceRateLimit("login:b", rule)).resolves.toBeUndefined();
  });

  it("resets when the window rolls over", async () => {
    const rule = { limit: 1, windowMs: 1000 };
    const realNow = Date.now;
    try {
      Date.now = () => 10_000;
      await enforceRateLimit("login:x", rule);
      await expect(enforceRateLimit("login:x", rule)).rejects.toMatchObject({ status: 429 });
      Date.now = () => 20_000; // next window
      await expect(enforceRateLimit("login:x", rule)).resolves.toBeUndefined();
    } finally {
      Date.now = realNow;
    }
  });
});
