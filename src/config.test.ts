import { afterEach, describe, expect, test } from "bun:test";
import { loadConfig } from "./config";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("loadConfig", () => {
  test("preserves empty RENDER_BRANCH as an unrestricted branch filter", () => {
    process.env.LINEAR_API_KEY = "lin_api_test";
    process.env.RENDER_API_KEY = "rnd_test";
    process.env.LINEAR_TICKET_PREFIXES = "TEST";
    process.env.RENDER_BRANCH = "";
    process.env.DRY_RUN = "true";

    expect(loadConfig().renderBranch).toBe("");
  });
});
