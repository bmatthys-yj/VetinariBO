import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadEnvFile } from "../src/env.js";

const KEYS = ["VETINARI_BO_TEST_FROM_FILE", "VETINARI_BO_TEST_FROM_SHELL"] as const;

let directory: string;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "vetinari-bo-env-"));
});

afterEach(() => {
  for (const key of KEYS) delete process.env[key];
  rmSync(directory, { recursive: true, force: true });
});

describe("loadEnvFile", () => {
  it("loads values from the file", () => {
    const file = join(directory, ".env");
    writeFileSync(file, "VETINARI_BO_TEST_FROM_FILE=from-file\n");
    expect(loadEnvFile(file)).toBe(true);
    expect(process.env.VETINARI_BO_TEST_FROM_FILE).toBe("from-file");
  });

  it("lets a variable already in the environment win over the file", () => {
    const file = join(directory, ".env");
    writeFileSync(file, "VETINARI_BO_TEST_FROM_SHELL=from-file\n");
    process.env.VETINARI_BO_TEST_FROM_SHELL = "from-shell";
    loadEnvFile(file);
    expect(process.env.VETINARI_BO_TEST_FROM_SHELL).toBe("from-shell");
  });

  it("does nothing when there is no file", () => {
    expect(loadEnvFile(join(directory, "missing.env"))).toBe(false);
  });
});
