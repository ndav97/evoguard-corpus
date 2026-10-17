// Tests ocultos del estudio.
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { GitCommitLink } from "../publisher/utils/formatGitCommit";

const writeText = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  writeText.mockReset();
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

const flush = () =>
  act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

describe("T004 · copiar el identificador", () => {
  test("copia el identificador completo y normalizado", async () => {
    writeText.mockImplementation(() => Promise.resolve());
    render(
      <GitCommitLink
        commitId=" ABCDEF1234567890 "
        githubRepository="owner/repo"
        showCopyButton
      />,
    );
    const button = screen.getByRole("button", { name: "Copy commit ID" });
    expect(button).toHaveTextContent("Copy");
    expect(button).toHaveAttribute("type", "button");
    expect(button.closest("span.git-commit")).not.toBeNull();
    fireEvent.click(button);
    await flush();
    expect(writeText).toHaveBeenCalledWith("abcdef1234567890");
    expect(button).toHaveTextContent("Copied");
    expect(screen.getByRole("status")).toHaveTextContent("Commit ID copied");
  });

  test("a los 2 segundos vuelve al estado inicial", async () => {
    writeText.mockImplementation(() => Promise.resolve());
    render(<GitCommitLink commitId="abcdef1234567890" showCopyButton />);
    const button = screen.getByRole("button", { name: "Copy commit ID" });
    fireEvent.click(button);
    await flush();
    act(() => {
      vi.advanceTimersByTime(1999);
    });
    expect(button).toHaveTextContent("Copied");
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(button).toHaveTextContent("Copy");
    expect(screen.getByRole("status").textContent).toBe("");
  });

  test("si falla lo anuncia y el botón sigue diciendo Copy", async () => {
    writeText.mockImplementation(() => Promise.reject(new Error("denied")));
    render(<GitCommitLink commitId="abcdef1234567890" showCopyButton />);
    fireEvent.click(screen.getByRole("button", { name: "Copy commit ID" }));
    await flush();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Could not copy commit ID",
    );
    expect(screen.getByRole("button", { name: "Copy commit ID" })).toHaveTextContent(
      "Copy",
    );
  });

  test("una nueva pulsación reinicia el plazo", async () => {
    writeText.mockImplementation(() => Promise.resolve());
    render(<GitCommitLink commitId="abcdef1234567890" showCopyButton />);
    const button = screen.getByRole("button", { name: "Copy commit ID" });
    fireEvent.click(button);
    await flush();
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    fireEvent.click(button);
    await flush();
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(button).toHaveTextContent("Copied");
  });

  test("sin showCopyButton o sin identificador válido no hay botón", () => {
    const { container, unmount } = render(
      <GitCommitLink commitId="abcdef1234567890" />,
    );
    expect(screen.queryByRole("button")).toBeNull();
    expect(container.querySelector(".git-commit")).toBeNull();
    unmount();
    render(<GitCommitLink commitId="not-a-commit" showCopyButton />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("-")).toBeInTheDocument();
  });

  test("al desmontar no quedan temporizadores pendientes", async () => {
    writeText.mockImplementation(() => Promise.resolve());
    const { unmount } = render(
      <GitCommitLink commitId="abcdef1234567890" showCopyButton />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Copy commit ID" }));
    await flush();
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
