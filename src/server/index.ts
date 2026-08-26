/**
 * @module next-easytour/server
 *
 * Server helpers for persisting an edited tutorial. Node-only — import
 * from `next-easytour/server`, never from a client component.
 *
 * A tour saved from the editor has to land somewhere. Every host was
 * writing the same route handler to do it, and getting the same things
 * wrong: forgetting the production guard, allowing an unvalidated body
 * straight onto disk, and — because the target filename was buried in
 * the handler body — copy-pasting a route that silently wrote to the
 * wrong file, so Save reported success and changed nothing.
 *
 * `createTutorialFileRoute` takes the filename as a required argument,
 * validates the payload, refuses every write in a production build, and
 * writes atomically.
 *
 * ```ts
 * // app/api/tutorial/route.ts
 * import { createTutorialFileRoute } from "next-easytour/server";
 *
 * export const { GET, POST } = createTutorialFileRoute({
 *   file: "public/tour.json",
 *   authorize: async (req) => (await getSession(req))?.role === "admin",
 * });
 * ```
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { normalizeTutorial, type NormalizedTutorial } from "../data/normalize";
import type { Step, TriggerConfig } from "../types";

// ── Options ─────────────────────────────────────────────────────────────

export interface TutorialFileRouteOptions<Meta = never> {
  /**
   * Path to the tutorial JSON, relative to `process.cwd()` (or absolute).
   * Required, and required to stay inside the project directory.
   */
  file: string;
  /**
   * Narrow who may write, *within* development. Return false to reject
   * with 403.
   *
   * This cannot widen access: production writes are refused before
   * `authorize` is consulted, to match the client editor, which does not
   * run in production either. A save endpoint that outlived the editor
   * would be a writable content API with nothing in front of it.
   */
  authorize?: (request: Request) => boolean | Promise<boolean>;
  /**
   * Serve the file over GET as well. Default `false` — most hosts serve
   * the JSON as a static asset and only need the write side.
   */
  read?: boolean;
  /** Indent saved JSON for reviewable diffs. Default `true`. */
  pretty?: boolean;
  /**
   * Write a bare `Step[]` array instead of a `{ steps, trigger }`
   * envelope, for compatibility with an existing 0.2/0.3 file. Note that
   * the trigger config cannot be persisted in this format.
   * Default `false`.
   */
  bareArray?: boolean;
  /** Inspect or rewrite the payload before it is written. */
  transform?: (payload: NormalizedTutorial<Meta>) => NormalizedTutorial<Meta>;
}

export interface TutorialFileRoute {
  GET: (request: Request) => Promise<Response>;
  POST: (request: Request) => Promise<Response>;
  PUT: (request: Request) => Promise<Response>;
}

// ── Helpers ─────────────────────────────────────────────────────────────

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Resolve `file` and refuse anything outside the project root.
 *
 * The filename is a developer-supplied constant, not user input, so this
 * is a guard against a mistake rather than an attack — but a route that
 * can write anywhere on the filesystem is worth ruling out by
 * construction.
 */
function resolveTarget(file: string): string {
  const root = process.cwd();
  const target = path.resolve(root, file);
  const rel = path.relative(root, target);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(
      `[next-easytour] refusing to write outside the project directory: ${file}`,
    );
  }
  return target;
}

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Write via a temp file in the same directory, then rename. */
async function writeAtomic(target: string, contents: string): Promise<void> {
  await fs.mkdir(path.dirname(target), { recursive: true });
  const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
  try {
    await fs.writeFile(tmp, contents, "utf-8");
    await fs.rename(tmp, target);
  } catch (err) {
    // A half-written temp file left behind would be worse than the
    // failure itself; the original file is untouched either way.
    await fs.rm(tmp, { force: true }).catch(() => {});
    throw err;
  }
}

// ── Route factory ───────────────────────────────────────────────────────

export function createTutorialFileRoute<Meta = never>(
  options: TutorialFileRouteOptions<Meta>,
): TutorialFileRoute {
  const {
    file,
    authorize,
    read = false,
    pretty = true,
    bareArray = false,
    transform,
  } = options;

  // Fail at module load, not on the first save, if `file` escapes root.
  const target = resolveTarget(file);

  const handleWrite = async (request: Request): Promise<Response> => {
    // Checked first, and not overridable: `authorize` narrows access,
    // it never grants it.
    if (isProduction()) {
      return json(
        {
          error:
            "Tutorial editing is disabled in production builds and cannot be " +
            "enabled. Author tutorials in development and deploy the JSON.",
        },
        403,
      );
    }

    if (authorize && !(await authorize(request))) {
      return json({ error: "Not authorised to edit this tutorial." }, 403);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Request body is not valid JSON." }, 400);
    }

    // Normalising here means a hand-edited or legacy-shaped payload is
    // stored in the current format, and a malformed one is rejected
    // before it can replace a working file.
    let payload = normalizeTutorial<Meta>(body as never);
    if (payload.steps.length === 0) {
      return json({ error: "Payload contained no steps; refusing to overwrite." }, 400);
    }
    if (transform) payload = transform(payload);

    const out: Step<Meta>[] | { steps: Step<Meta>[]; trigger?: TriggerConfig; version: number } =
      bareArray ? payload.steps : payload;

    try {
      await writeAtomic(target, JSON.stringify(out, null, pretty ? 2 : 0) + "\n");
    } catch (err) {
      return json({ error: `Failed to write ${file}: ${String(err)}` }, 500);
    }

    return json({ ok: true, file, steps: payload.steps.length });
  };

  const handleRead = async (request: Request): Promise<Response> => {
    if (!read) return json({ error: "Method not allowed." }, 405);
    try {
      const contents = await fs.readFile(target, "utf-8");
      return new Response(contents, {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    } catch {
      // A missing file is an empty tutorial, not an error — it is the
      // normal state before anything has been authored.
      return json({ steps: [], version: 1 });
    }
  };

  return { GET: handleRead, POST: handleWrite, PUT: handleWrite };
}

export { normalizeTutorial, normalizeSteps, normalizeStep } from "../data/normalize";
export type { NormalizedTutorial, RawTutorial } from "../data/normalize";
