import { describe, expect, test } from "bun:test";
import { parseImageCommitRef } from "./image";

describe("parseImageCommitRef", () => {
  test("parses GHCR image refs tagged with a full commit SHA", () => {
    expect(
      parseImageCommitRef(
        "ghcr.io/example-org/api-service:205dc365297b0b7ae7f32bddda811bae3de5a4bf"
      )
    ).toEqual({
      owner: "example-org",
      repo: "api-service",
      commitId: "205dc365297b0b7ae7f32bddda811bae3de5a4bf",
    });
  });

  test("ignores floating tags because they do not identify a source commit", () => {
    expect(parseImageCommitRef("ghcr.io/example-org/api-service:latest")).toBe(
      null
    );
  });
});
