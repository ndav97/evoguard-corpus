// Tests ocultos del estudio.
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { formatCommitId, GitCommitLink } from "../publisher/utils/formatGitCommit";

const id = "0123456789abcdef0123456789abcdef01234567";

describe("T002 · longitud del identificador", () => {
  test("respeta la longitud pedida", () => {
    expect(formatCommitId(id, 12)).toBe("0123456789ab");
    expect(formatCommitId(id)).toBe("0123456");
  });

  test("limita la longitud entre 4 y 40", () => {
    expect(formatCommitId(id, 2)).toBe("0123");
    expect(formatCommitId(id, 4)).toBe("0123");
    expect(formatCommitId(id + "89", 50)).toBe(id);
  });

  test("una longitud que no es entera usa 7", () => {
    expect(formatCommitId(id, 7.5)).toBe("0123456");
    expect(formatCommitId(id, Number.NaN)).toBe("0123456");
  });

  test("si el identificador es más corto se devuelve completo", () => {
    expect(formatCommitId("abcdef12", 20)).toBe("abcdef12");
  });

  test("la validación no cambia con longitudes cortas", () => {
    expect(formatCommitId("abcdef", 4)).toBeNull();
  });

  test("GitCommitLink usa la longitud en el texto, el title y el aria-label", () => {
    render(<GitCommitLink commitId={id} githubRepository="owner/repo" length={10} />);
    const link = screen.getByRole("link");
    expect(link).toHaveTextContent("0123456789");
    expect(link).toHaveAttribute("title", "View commit 0123456789 on GitHub");
    expect(link).toHaveAttribute("aria-label", "View commit 0123456789 on GitHub");
    expect(link).toHaveAttribute("href", `https://github.com/owner/repo/commit/${id}`);
  });

  test("sin enlace también", () => {
    render(<GitCommitLink commitId={id} length={9} />);
    expect(screen.getByText("012345678").tagName).toBe("SPAN");
  });
});
