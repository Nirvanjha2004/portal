/**
 * Smoke test — verifies the Next.js dev server starts and the home page
 * (which redirects to /login for unauthenticated users) returns a 2xx/3xx.
 *
 * This test starts the Next.js production build server on a random port,
 * makes a GET request to /, and asserts the response is not a 5xx error.
 *
 * Prerequisites: run `npm run build` before running this test.
 */
import { spawn, ChildProcess } from "child_process";
import http from "http";
import path from "path";

const PORT = 3099;
const BASE_URL = `http://localhost:${PORT}`;
const STARTUP_TIMEOUT_MS = 30_000;

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
            reject(new Error(`Server at ${url} did not start within ${timeoutMs}ms`));
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

    server = spawn(
      "node",
      ["node_modules/.bin/next", "start", "--port", String(PORT)],
      {
        cwd: projectRoot,
        env: {
          ...process.env,
          PORT: String(PORT),
          // Provide minimal env so Next.js starts without crashing
          DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://localhost/test",
          REDIS_URL: process.env.REDIS_URL ?? "redis://localhost:6379",
          NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ?? "smoke-test-secret-32-chars-long!!",
          NEXTAUTH_URL: `http://localhost:${PORT}`,
        },
        stdio: "pipe",
      }
    );

    server.stderr?.on("data", (d) => {
      // Suppress noisy output during tests
      if (process.env.DEBUG_SMOKE) process.stderr.write(d);
    });

    await waitForServer(`${BASE_URL}/api/auth/session`, STARTUP_TIMEOUT_MS);
  }, STARTUP_TIMEOUT_MS + 5_000);

  afterAll(() => {
    server?.kill("SIGTERM");
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
