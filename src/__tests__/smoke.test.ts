/**
 * Smoke test — verifies the Next.js production server starts and the home
 * page (which redirects to /login for unauthenticated users) returns a
 * 2xx/3xx status code.
 *
 * Prerequisites: run `npm run build` before running this test.
 *
 * The test spawns `next start` on a dedicated port, waits for it to be
 * ready, then makes HTTP requests and asserts on the status codes.
 */
import { spawn, ChildProcess } from "child_process";
import http from "http";
import path from "path";

const PORT = 3099;
const BASE_URL = `http://localhost:${PORT}`;
const STARTUP_TIMEOUT_MS = 45_000;

/** Polls the given URL until it responds (any status) or the timeout elapses. */
function waitForServer(url: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;

    function attempt() {
      http
        .get(url, (res) => {
          res.resume(); // drain the response
          resolve();
        })
        .on("error", () => {
          if (Date.now() > deadline) {
            reject(
              new Error(
                `Server at ${url} did not start within ${timeoutMs}ms`
              )
            );
          } else {
            setTimeout(attempt, 500);
          }
        });
    }

    attempt();
  });
}

function getStatusCode(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      })
      .on("error", reject);
  });
}

describe("Smoke test — home page", () => {
  let server: ChildProcess;

  beforeAll(async () => {
    const projectRoot = path.resolve(__dirname, "../..");
    const isWindows = process.platform === "win32";

    // On Windows, npm/npx scripts are .cmd files and require shell:true
    server = spawn("npx", ["next", "start", "--port", String(PORT)], {
      cwd: projectRoot,
      env: {
        ...process.env,
        PORT: String(PORT),
        // Provide minimal env so Next.js starts without crashing
        DATABASE_URL:
          process.env.DATABASE_URL ?? "postgresql://localhost:5432/test",
        REDIS_URL: process.env.REDIS_URL ?? "redis://localhost:6379",
        NEXTAUTH_SECRET:
          process.env.NEXTAUTH_SECRET ?? "smoke-test-secret-32-chars-long!!",
        NEXTAUTH_URL: `http://localhost:${PORT}`,
      },
      stdio: "pipe",
      shell: isWindows,
    });

    server.stderr?.on("data", (d) => {
      // Suppress noisy output during tests unless DEBUG_SMOKE is set
      if (process.env.DEBUG_SMOKE) process.stderr.write(d);
    });

    await waitForServer(`${BASE_URL}/api/auth/session`, STARTUP_TIMEOUT_MS);
  }, STARTUP_TIMEOUT_MS + 10_000);

  afterAll(() => {
    if (server) {
      // On Windows, kill the entire process tree
      if (process.platform === "win32") {
        spawn("taskkill", ["/pid", String(server.pid), "/f", "/t"], {
          stdio: "ignore",
        });
      } else {
        server.kill("SIGTERM");
      }
    }
  });

  it("GET / returns a non-5xx status code", async () => {
    const status = await getStatusCode(BASE_URL);
    // The root page redirects unauthenticated users to /login (302/307)
    // or returns 200 if already on the login page.
    expect(status).toBeGreaterThanOrEqual(200);
    expect(status).toBeLessThan(500);
  });

  it("GET /login returns 200", async () => {
    const status = await getStatusCode(`${BASE_URL}/login`);
    expect(status).toBe(200);
  });
});
