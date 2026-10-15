import React from "react";
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { Tasks } from "../../src/pages/Tasks";
import { UIPreferencesContext } from "../../src/contexts/UIPreferencesContext";
import { setupAPIMock } from "../testutils/api-mocks";
import { setupIntervalMocks, cleanupIntervalMocks } from "../testutils/interval-mocks";

vi.mock("react-router", async () => {
  const { createRouterMock } = await import("../testutils/react-router-mock.jsx");
  return createRouterMock({ components: { only: true } })();
});

const prefs = {
  pageSize: 10,
  theme: "light",
  bytesStringBase2: false,
  defaultSnapshotViewAll: false,
  fontSize: "fs-6",
  setTheme: vi.fn(),
  setPageSize: vi.fn(),
  setByteStringBase: vi.fn(),
  setDefaultSnapshotViewAll: vi.fn(),
  setFontSize: vi.fn(),
};

let axiosMock;

beforeEach(() => {
  axiosMock = setupAPIMock();
  vi.clearAllMocks();
  setupIntervalMocks();
});

afterEach(() => {
  axiosMock.reset();
  cleanupIntervalMocks();
});

const task = (id, kind, description, status, minute = 0) => ({
  id,
  kind,
  description,
  status,
  startTime: `2023-01-01T10:${String(minute).padStart(2, "0")}:00Z`,
});

async function renderWith(tasks) {
  axiosMock.onGet("/api/v1/tasks").reply(200, { tasks });
  render(
    <UIPreferencesContext.Provider value={prefs}>
      <Tasks />
    </UIPreferencesContext.Provider>,
  );
  await waitFor(() => expect(screen.queryByText("Loading ...")).not.toBeInTheDocument());
}

async function choose(prefix, label) {
  const toggle = screen.getByText(new RegExp(`^${prefix}: `));
  await userEvent.click(toggle);
  const menu = await waitFor(() => {
    const open = toggle.closest(".dropdown").querySelector(".dropdown-menu.show");
    expect(open).not.toBeNull();
    return open;
  });
  await userEvent.click(within(menu).getByText(label));
}

function search(value) {
  fireEvent.change(screen.getByRole("textbox"), { target: { value } });
}

// T004 — Casilla «Match case» para buscar sin distinguir mayúsculas.
describe("T004 · búsqueda con «Match case»", () => {
  const tasks = [
    task("t1", "Snapshot", "Backup Photos", "SUCCESS", 1),
    task("t2", "Maintenance", "Quick maintenance", "RUNNING", 2),
    task("t3", "Snapshot", "backup documents", "RUNNING", 3),
  ];
  const matchCase = () => screen.getByRole("checkbox", { name: "Match case" });

  test("la casilla está marcada por defecto y la búsqueda distingue mayúsculas", async () => {
    await renderWith(tasks);
    expect(matchCase()).toBeChecked();
    expect(screen.getByPlaceholderText("case-sensitive search description")).toBeInTheDocument();
    search("Backup");
    expect(screen.getByText("Showing 1 of 3 tasks")).toBeInTheDocument();
    expect(screen.getByText("Backup Photos")).toBeInTheDocument();
    expect(screen.queryByText("backup documents")).not.toBeInTheDocument();
  });

  test("al desmarcarla la búsqueda ignora mayúsculas y cambia el texto de ayuda", async () => {
    await renderWith(tasks);
    await userEvent.click(matchCase());
    expect(matchCase()).not.toBeChecked();
    expect(screen.getByPlaceholderText("search description")).toBeInTheDocument();
    search("BACKUP");
    expect(screen.getByText("Showing 2 of 3 tasks")).toBeInTheDocument();
    expect(screen.getByText("Backup Photos")).toBeInTheDocument();
    expect(screen.getByText("backup documents")).toBeInTheDocument();
  });

  test("volver a marcarla restablece la búsqueda exacta", async () => {
    await renderWith(tasks);
    await userEvent.click(matchCase());
    search("backup");
    expect(screen.getByText("Showing 2 of 3 tasks")).toBeInTheDocument();
    await userEvent.click(matchCase());
    expect(screen.getByText("Showing 1 of 3 tasks")).toBeInTheDocument();
    expect(screen.queryByText("Backup Photos")).not.toBeInTheDocument();
  });

  test("la casilla no cuenta como filtro y «Clear filters» no la cambia", async () => {
    await renderWith(tasks);
    await userEvent.click(matchCase());
    expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();
    search("zzz");
    expect(screen.getByText("No tasks match the current filters.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(matchCase()).not.toBeChecked();
    expect(screen.getByRole("textbox")).toHaveValue("");
    expect(screen.getByText("Showing 3 of 3 tasks")).toBeInTheDocument();
  });

  test("cancelar todas respeta la búsqueda sin distinguir mayúsculas", async () => {
    axiosMock.onPost(/\/api\/v1\/tasks\/.+\/cancel/).reply(200, {});
    await renderWith(tasks);
    await userEvent.click(matchCase());
    search("BACKUP");
    await userEvent.click(screen.getByRole("button", { name: "Cancel all running tasks" }));
    await waitFor(() => expect(screen.getByText("Requested cancellation of 1 task.")).toBeInTheDocument());
    expect(axiosMock.history.post.map((r) => r.url)).toEqual(["/api/v1/tasks/t3/cancel"]);
  });
});
