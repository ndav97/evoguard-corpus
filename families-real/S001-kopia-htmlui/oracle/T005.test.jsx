import React from "react";
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { Tasks } from "../../src/pages/Tasks";
import { UIPreferencesContext } from "../../src/contexts/UIPreferencesContext";
import { setupAPIMock } from "../testutils/api-mocks";
import { setupIntervalMocks, cleanupIntervalMocks, triggerIntervals } from "../testutils/interval-mocks";

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

// T005 — Pausar y reanudar el refresco automático de la lista.
describe("T005 · pausar el refresco automático", () => {
  const tasks = [
    task("t1", "Snapshot", "Backup photos", "SUCCESS", 1),
    task("t2", "Maintenance", "Quick maintenance", "RUNNING", 2),
  ];
  const fetches = () => axiosMock.history.get.filter((r) => r.url === "/api/v1/tasks").length;
  const pause = () => screen.queryByRole("button", { name: "Pause auto-refresh" });
  const resume = () => screen.queryByRole("button", { name: "Resume auto-refresh" });

  test("sin pausa, la lista se sigue refrescando periódicamente", async () => {
    await renderWith(tasks);
    expect(pause()).toBeInTheDocument();
    expect(screen.queryByText("Auto-refresh paused.")).not.toBeInTheDocument();
    const before = fetches();
    await triggerIntervals();
    await waitFor(() => expect(fetches()).toBe(before + 1));
  });

  test("al pausar deja de refrescar, cambia el botón y lo indica", async () => {
    await renderWith(tasks);
    await userEvent.click(pause());
    expect(resume()).toBeInTheDocument();
    expect(pause()).not.toBeInTheDocument();
    expect(screen.getByText("Auto-refresh paused.")).toBeInTheDocument();
    const before = fetches();
    await triggerIntervals();
    await triggerIntervals();
    expect(fetches()).toBe(before);
  });

  test("al reanudar pide la lista enseguida y vuelve a refrescar", async () => {
    await renderWith(tasks);
    await userEvent.click(pause());
    const before = fetches();
    axiosMock.onGet("/api/v1/tasks").reply(200, { tasks: [...tasks, task("t3", "Snapshot", "Backup music", "RUNNING", 3)] });
    await userEvent.click(resume());
    await waitFor(() => expect(fetches()).toBe(before + 1));
    await waitFor(() => expect(screen.getByText("Showing 3 of 3 tasks")).toBeInTheDocument());
    expect(pause()).toBeInTheDocument();
    expect(screen.queryByText("Auto-refresh paused.")).not.toBeInTheDocument();
    await triggerIntervals();
    await waitFor(() => expect(fetches()).toBe(before + 2));
  });

  test("en pausa, cancelar todas sigue refrescando la lista al terminar", async () => {
    axiosMock.onPost(/\/api\/v1\/tasks\/.+\/cancel/).reply(200, {});
    await renderWith(tasks);
    await userEvent.click(pause());
    const before = fetches();
    await userEvent.click(screen.getByRole("button", { name: "Cancel all running tasks" }));
    await waitFor(() => expect(screen.getByText("Requested cancellation of 1 task.")).toBeInTheDocument());
    await waitFor(() => expect(fetches()).toBe(before + 1));
    expect(resume()).toBeInTheDocument();
  });

  test("la pausa no altera filtros ni resumen", async () => {
    await renderWith(tasks);
    await choose("Status", "Running");
    await userEvent.click(pause());
    expect(screen.getByText("Showing 1 of 2 tasks")).toBeInTheDocument();
    expect(screen.getByText("Status: Running")).toBeInTheDocument();
  });
});
