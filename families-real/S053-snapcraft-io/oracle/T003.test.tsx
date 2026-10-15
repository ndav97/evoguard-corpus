// Tests ocultos del estudio.
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import {
  createGitHubCommitUrl,
  GitCommitLink,
  normalizeGitHubRepository,
} from "../publisher/utils/formatGitCommit";

describe("T003 · repositorio normalizado", () => {
  test("acepta las formas habituales", () => {
    const forms = [
      "canonical/snapcraft",
      " canonical/snapcraft ",
      "canonical/snapcraft.git",
      "canonical/snapcraft/",
      "github.com/canonical/snapcraft",
      "https://github.com/canonical/snapcraft",
      "http://www.github.com/canonical/snapcraft.git/",
      "https://GitHub.com/canonical/snapcraft",
      "git@github.com:canonical/snapcraft.git",
    ];
    for (const form of forms) {
      expect(normalizeGitHubRepository(form)).toBe("canonical/snapcraft");
    }
  });

  test("conserva puntos, guiones y guiones bajos del nombre", () => {
    expect(normalizeGitHubRepository("my-org/snapcraft.io")).toBe(
      "my-org/snapcraft.io",
    );
    expect(normalizeGitHubRepository("a_b/c-d.git")).toBe("a_b/c-d");
  });

  test("rechaza el resto", () => {
    const invalid = [
      "",
      "invalid-repo",
      "owner/repo/extra",
      "https://github.com/owner/repo/tree/main",
      "https://gitlab.com/owner/repo",
      "owner/re po",
      "../repo",
      "owner/..",
    ];
    for (const value of invalid) {
      expect(normalizeGitHubRepository(value)).toBeNull();
    }
    expect(normalizeGitHubRepository(null)).toBeNull();
    expect(normalizeGitHubRepository(undefined)).toBeNull();
  });

  test("createGitHubCommitUrl usa el repositorio normalizado", () => {
    expect(
      createGitHubCommitUrl(
        "git@github.com:canonical/snapcraft.git",
        "ABCDEF1234",
      ),
    ).toBe("https://github.com/canonical/snapcraft/commit/abcdef1234");
    expect(createGitHubCommitUrl("owner/repo/extra", "abcdef1234")).toBeNull();
  });

  test("GitCommitLink enlaza con una URL de repositorio", () => {
    render(
      <GitCommitLink
        commitId="abcdef1234567890"
        githubRepository="https://github.com/owner/repo.git"
      />,
    );
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "https://github.com/owner/repo/commit/abcdef1234567890",
    );
  });
});
