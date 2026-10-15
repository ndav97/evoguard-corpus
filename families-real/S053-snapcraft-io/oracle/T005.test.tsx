// Tests ocultos del estudio.
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import {
  createCommitUrl,
  createGitHubCommitUrl,
  GitCommitLink,
} from "../publisher/utils/formatGitCommit";

const id = "ABCDEF1234567890";

describe("T005 · GitLab y Bitbucket", () => {
  test("GitLab, con subgrupos y remotos SSH", () => {
    expect(createCommitUrl("https://gitlab.com/group/sub/app.git", id)).toEqual({
      url: "https://gitlab.com/group/sub/app/-/commit/abcdef1234567890",
      host: "GitLab",
    });
    expect(createCommitUrl("git@GitLab.com:team/tool", id)?.url).toBe(
      "https://gitlab.com/team/tool/-/commit/abcdef1234567890",
    );
    expect(createCommitUrl(" www.gitlab.com/a/b/ ", id)?.host).toBe("GitLab");
  });

  test("Bitbucket con dos partes", () => {
    expect(createCommitUrl("https://bitbucket.org/acme/snap.git", id)).toEqual({
      url: "https://bitbucket.org/acme/snap/commits/abcdef1234567890",
      host: "Bitbucket",
    });
    expect(createCommitUrl("git@bitbucket.org:acme/snap.git", id)?.host).toBe(
      "Bitbucket",
    );
    expect(createCommitUrl("https://bitbucket.org/acme/snap/extra", id)).toBeNull();
  });

  test("GitHub como siempre", () => {
    expect(createCommitUrl("owner/repo", id)).toEqual({
      url: "https://github.com/owner/repo/commit/abcdef1234567890",
      host: "GitHub",
    });
    expect(createCommitUrl("https://github.com/owner/repo", id)?.host).toBe("GitHub");
  });

  test("referencias no válidas", () => {
    expect(createCommitUrl("https://gitlab.com/solo", id)).toBeNull();
    expect(createCommitUrl("gitlab.com/x", id)).toBeNull();
    expect(createCommitUrl("https://gitlab.com/a/../b", id)).toBeNull();
    expect(createCommitUrl("https://example.com/a/b", id)).toBeNull();
    expect(createCommitUrl("owner/repo", "zzz")).toBeNull();
    expect(createCommitUrl(null, id)).toBeNull();
  });

  test("createGitHubCommitUrl sigue siendo solo de GitHub", () => {
    expect(createGitHubCommitUrl("https://gitlab.com/group/app", id)).toBeNull();
  });

  test("GitCommitLink nombra el sitio y prioriza repository", () => {
    render(
      <GitCommitLink
        commitId={id}
        githubRepository="owner/repo"
        repository="https://gitlab.com/group/app"
      />,
    );
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute(
      "href",
      "https://gitlab.com/group/app/-/commit/abcdef1234567890",
    );
    expect(link).toHaveAttribute("title", "View commit abcdef1 on GitLab");
    expect(link).toHaveAttribute("aria-label", "View commit abcdef1 on GitLab");
  });

  test("con githubRepository sigue enlazando a GitHub", () => {
    render(<GitCommitLink commitId={id} githubRepository="owner/repo" />);
    expect(screen.getByRole("link")).toHaveAttribute(
      "title",
      "View commit abcdef1 on GitHub",
    );
  });
});
