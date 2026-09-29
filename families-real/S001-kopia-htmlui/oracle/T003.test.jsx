import React from "react";
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
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

// T003 — Cancelar de una vez todas las tareas en curso visibles.
describe("T003 · «Cancel all running tasks»", () => {
  const tasks = [
    task("t1", "Snapshot", "Backup photos", "SUCCESS", 1),
    task("t2", "Maintenance", "Quick maintenance", "RUNNING", 2),
    task("t3", "Snapshot", "Backup documents", "FAILED", 3),
    task("t4", "Snapshot", "Backup music", "RUNNING", 4),
  ];
  const cancelAll = () => screen.queryByRole("button", { name: "Cancel all running tasks" });
  const cancelUrls = () => axiosMock.history.post.map((r) => r.url).sort();
  const taskFetches = () => axiosMock.history.get.filter((r) => r.url === "/api/v1/tasks").length;

  test("aparece solo si hay tareas en curso visibles", async () => {
    await renderWith(tasks);
    expect(cancelAll()).toBeInTheDocument();
    await choose("Status", "Failed");
    expect(cancelAll()).not.toBeInTheDocument();
  });

  test("no aparece si ninguna tarea está en curso", async () => {
    await renderWith([task("t1", "Snapshot", "Backup photos", "SUCCESS")]);
    expect(cancelAll()).not.toBeInTheDocument();
  });

  test("cancela todas las tareas en curso, avisa y refresca la lista", async () => {
    axiosMock.onPost(/\/api\/v1\/tasks\/.+\/cancel/).reply(200, {});
    await renderWith(tasks);
    const before = taskFetches();

    await userEvent.click(cancelAll());

    await waitFor(() => expect(screen.getByText("Requested cancellation of 2 tasks.")).toBeInTheDocument());
    expect(cancelUrls()).toEqual(["/api/v1/tasks/t2/cancel", "/api/v1/tasks/t4/cancel"]);
    await waitFor(() => expect(taskFetches()).toBeGreaterThan(before));
    // Añadido tras la segunda prueba de mutantes (2026-09-29): terminadas las peticiones, el botón vuelve a estar habilitado.
    await waitFor(() => expect(cancelAll()).toBeEnabled());
  });

  test("respeta los filtros: solo cancela las tareas visibles", async () => {
    axiosMock.onPost(/\/api\/v1\/tasks\/.+\/cancel/).reply(200, {});
    await renderWith(tasks);
    await choose("Kind", "Snapshot");

    await userEvent.click(cancelAll());

    await waitFor(() => expect(screen.getByText("Requested cancellation of 1 task.")).toBeInTheDocument());
    expect(cancelUrls()).toEqual(["/api/v1/tasks/t4/cancel"]);
    expect(screen.getByText("Showing 3 of 4 tasks")).toBeInTheDocument();
  });

  test("si alguna cancelación falla muestra una alerta y no el mensaje de éxito", async () => {
    axiosMock.onPost("/api/v1/tasks/t2/cancel").reply(500, {});
    axiosMock.onPost("/api/v1/tasks/t4/cancel").reply(200, {});
    await renderWith(tasks);

    await userEvent.click(cancelAll());

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Could not cancel 1 of 2 tasks."));
    expect(screen.queryByText(/^Requested cancellation/)).not.toBeInTheDocument();
  });

  test("el botón queda deshabilitado mientras hay cancelaciones pendientes", async () => {
    axiosMock.onPost(/\/api\/v1\/tasks\/.+\/cancel/).reply(() => new Promise(() => {}));
    await renderWith(tasks);

    await userEvent.click(cancelAll());

    await waitFor(() => expect(cancelAll()).toBeDisabled());
  });
});
