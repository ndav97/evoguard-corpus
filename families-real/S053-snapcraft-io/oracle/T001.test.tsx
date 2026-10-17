// Tests ocultos del estudio.
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import {
  createGitHubCommitUrl,
  formatCommitId,
  GitCommitLink,
  normalizeCommitId,
} from "../publisher/utils/formatGitCommit";

describe("T001 · identificador de commit", () => {
  test("normaliza espacios y mayúsculas", () => {
    expect(normalizeCommitId("  ABCDEF1234  ")).toBe("abcdef1234");
    expect(normalizeCommitId("0123456")).toBe("0123456");
  });

  test("rechaza lo que no es hexadecimal o es corto", () => {
    for (const value of ["test-revision-id", "abcdefg123", "abc12", "", "12 34567"]) {
      expect(normalizeCommitId(value)).toBeNull();
    }
    expect(normalizeCommitId(null)).toBeNull();
    expect(normalizeCommitId(undefined)).toBeNull();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(normalizeCommitId(1234567 as any)).toBeNull();
  });

  test("formatCommitId usa el identificador normalizado", () => {
    expect(formatCommitId(" ABCDEF1234567890 ")).toBe("abcdef1");
    expect(formatCommitId("test-revision-id")).toBeNull();
  });

  test("createGitHubCommitUrl usa el identificador completo normalizado", () => {
    expect(createGitHubCommitUrl("owner/repo", "ABCDEF1234567890 ")).toBe(
      "https://github.com/owner/repo/commit/abcdef1234567890",
    );
    expect(createGitHubCommitUrl("owner/repo", "not-a-commit")).toBeNull();
  });

  test("GitCommitLink muestra el guion con un identificador no válido", () => {
    render(
      <GitCommitLink commitId="test-revision-id" githubRepository="owner/repo" />,
    );
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("-")).toHaveAttribute(
      "aria-label",
      "No commit data available for this build",
    );
  });

  test("GitCommitLink enlaza al commit normalizado", () => {
    render(
      <GitCommitLink commitId="ABCDEF1234567890" githubRepository="owner/repo" />,
    );
    const link = screen.getByRole("link");
    expect(link).toHaveTextContent("abcdef1");
    expect(link).toHaveAttribute(
      "href",
      "https://github.com/owner/repo/commit/abcdef1234567890",
    );
  });
});
