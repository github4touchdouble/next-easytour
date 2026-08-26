/**
 * @vitest-environment node
 */
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTutorialFileRoute } from "../src/server";

// ────────────────────────────────────────────────────────────────────────
// Sandbox
// ────────────────────────────────────────────────────────────────────────
// The route resolves `file` against process.cwd(), so each test runs in
// its own temp directory rather than writing into the repo.

let dir: string;
let cwd: string;
const REL = "public/tour.json";

beforeEach(async () => {
  cwd = process.cwd();
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "easytour-"));
  process.chdir(dir);
});

afterEach(async () => {
  process.chdir(cwd);
  await fs.rm(dir, { recursive: true, force: true });
});

function post(body: unknown): Request {
  return new Request("http://test/api/tutorial", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function readTarget(): Promise<unknown> {
  return JSON.parse(await fs.readFile(path.join(dir, REL), "utf-8"));
}

const steps = [{ id: "a", title: "A" }];

// ────────────────────────────────────────────────────────────────────────
// Writing
// ────────────────────────────────────────────────────────────────────────

describe("createTutorialFileRoute — POST", () => {
  it("writes the payload and creates missing directories", async () => {
    const route = createTutorialFileRoute({ file: REL, authorize: () => true });
    const res = await route.POST(post({ steps, version: 1 }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, file: REL, steps: 1 });
    expect(await readTarget()).toMatchObject({ steps, version: 1 });
  });

  it("accepts a bare array and normalises it into an envelope", async () => {
    const route = createTutorialFileRoute({ file: REL, authorize: () => true });
    await route.POST(post(steps));
    expect(await readTarget()).toMatchObject({ steps, version: 1 });
  });

  it("normalises a legacy payload before storing it", async () => {
    const route = createTutorialFileRoute({ file: REL, authorize: () => true });
    await route.POST(post([{ id: "a", target: "umap", arrowTo: { x: 1, y: 2 } }]));

    const stored = (await readTarget()) as { steps: Array<Record<string, unknown>> };
    expect(stored.steps[0].targets).toEqual(["umap"]);
    expect(stored.steps[0].annotations).toEqual({
      arrow: { to: { space: "target", x: 1, y: 2 } },
    });
  });

  it("writes a bare array when bareArray is set", async () => {
    const route = createTutorialFileRoute({ file: REL, authorize: () => true, bareArray: true });
    await route.POST(post({ steps, version: 1 }));
    expect(await readTarget()).toEqual(steps);
  });

  it("accepts PUT as well as POST", async () => {
    const route = createTutorialFileRoute({ file: REL, authorize: () => true });
    expect((await route.PUT(post({ steps, version: 1 }))).status).toBe(200);
  });

  it("awaits an async authorize", async () => {
    const route = createTutorialFileRoute({
      file: REL,
      authorize: async () => { await Promise.resolve(); return true; },
    });
    expect((await route.POST(post(steps))).status).toBe(200);
  });

  it("passes the request to authorize so it can read headers", async () => {
    const route = createTutorialFileRoute({
      file: REL,
      authorize: (req) => req.headers.get("x-role") === "admin",
    });
    const req = new Request("http://test/api/tutorial", {
      method: "POST",
      headers: { "x-role": "admin" },
      body: JSON.stringify(steps),
    });
    expect((await route.POST(req)).status).toBe(200);
  });

  it("applies a transform before writing", async () => {
    const route = createTutorialFileRoute({
      file: REL,
      authorize: () => true,
      transform: (payload) => ({ ...payload, version: 42 }),
    });
    await route.POST(post(steps));
    expect((await readTarget() as { version: number }).version).toBe(42);
  });
});

// ────────────────────────────────────────────────────────────────────────
// Refusals — the file must survive a bad request untouched
// ────────────────────────────────────────────────────────────────────────

describe("createTutorialFileRoute — refusals", () => {
  it("rejects an unauthorised write with 403", async () => {
    const route = createTutorialFileRoute({ file: REL, authorize: () => false });
    const res = await route.POST(post(steps));
    expect(res.status).toBe(403);
    await expect(fs.access(path.join(dir, REL))).rejects.toThrow();
  });

  it("rejects a non-JSON body with 400", async () => {
    const route = createTutorialFileRoute({ file: REL, authorize: () => true });
    const req = new Request("http://test/api/tutorial", { method: "POST", body: "not json" });
    expect((await route.POST(req)).status).toBe(400);
  });

  it("refuses to overwrite with an empty step list", async () => {
    // A save that produced no steps is far more likely to be a bug than
    // an intentional wipe, and the existing file is the only copy.
    const route = createTutorialFileRoute({ file: REL, authorize: () => true });
    await route.POST(post(steps));

    const res = await route.POST(post([]));
    expect(res.status).toBe(400);
    expect(await readTarget()).toMatchObject({ steps });
  });

  it("refuses a file path that escapes the project directory", () => {
    expect(() => createTutorialFileRoute({ file: "../../etc/tour.json" }))
      .toThrow(/outside the project directory/);
  });

  it("refuses an absolute path outside the project directory", () => {
    expect(() => createTutorialFileRoute({ file: "/etc/tour.json" }))
      .toThrow(/outside the project directory/);
  });

  it("denies writes in production", async () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const route = createTutorialFileRoute({ file: REL });
      const res = await route.POST(post(steps));
      expect(res.status).toBe(403);
      expect((await res.json() as { error: string }).error).toMatch(/disabled in production/);
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it("denies writes in production even when authorize approves", async () => {
    // `authorize` narrows access, it never grants it. A save endpoint
    // that outlived the client editor would be an unguarded write API,
    // so the production check runs first and takes no arguments.
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const route = createTutorialFileRoute({ file: REL, authorize: () => true });
      const res = await route.POST(post(steps));
      expect(res.status).toBe(403);
      expect((await res.json() as { error: string }).error).toMatch(/cannot be enabled/);
      await expect(fs.access(path.join(dir, REL))).rejects.toThrow();
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it("still consults authorize in development", async () => {
    const route = createTutorialFileRoute({ file: REL, authorize: () => false });
    const res = await route.POST(post(steps));
    expect(res.status).toBe(403);
    expect((await res.json() as { error: string }).error).toMatch(/Not authorised/);
  });

  it("leaves no temp files behind after a successful write", async () => {
    const route = createTutorialFileRoute({ file: REL, authorize: () => true });
    await route.POST(post(steps));
    const entries = await fs.readdir(path.join(dir, "public"));
    expect(entries).toEqual(["tour.json"]);
  });
});

// ────────────────────────────────────────────────────────────────────────
// Reading
// ────────────────────────────────────────────────────────────────────────

describe("createTutorialFileRoute — GET", () => {
  it("is 405 unless reading is enabled", async () => {
    const route = createTutorialFileRoute({ file: REL, authorize: () => true });
    expect((await route.GET(new Request("http://test/api/tutorial"))).status).toBe(405);
  });

  it("serves the file when reading is enabled", async () => {
    const route = createTutorialFileRoute({ file: REL, authorize: () => true, read: true });
    await route.POST(post(steps));

    const res = await route.GET(new Request("http://test/api/tutorial"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toMatchObject({ steps });
  });

  it("treats a missing file as an empty tutorial, not an error", async () => {
    const route = createTutorialFileRoute({ file: REL, read: true });
    const res = await route.GET(new Request("http://test/api/tutorial"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ steps: [], version: 1 });
  });
});
