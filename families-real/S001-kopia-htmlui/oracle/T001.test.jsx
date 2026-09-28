import React from "react";
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
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

function search(value) {
  fireEvent.change(screen.getByRole("textbox"), { target: { value } });
}

// T001 — Resumen de resultados en la lista de tareas.
describe("T001 · resumen «Showing N of M tasks»", () => {
  const three = [
    task("t1", "Snapshot", "Backup photos", "SUCCESS", 1),
    task("t2", "Maintenance", "Quick maintenance", "RUNNING", 2),
    task("t3", "Snapshot", "Backup documents", "FAILED", 3),
  ];

  test("muestra el total cuando no hay filtros", async () => {
    await renderWith(three);
    expect(screen.getByText("Showing 3 of 3 tasks")).toBeInTheDocument();
  });

  test("usa singular cuando hay una sola tarea", async () => {
    await renderWith([task("t1", "Snapshot", "Only one", "SUCCESS")]);
    expect(screen.getByText("Showing 1 of 1 task")).toBeInTheDocument();
  });

  test("no muestra resumen cuando no hay tareas", async () => {
    await renderWith([]);
    expect(screen.queryByText(/^Showing \d+ of \d+ tasks?$/)).not.toBeInTheDocument();
  });

  test("refleja el filtro de estado", async () => {
    await renderWith(three);
    await choose("Status", "Running");
    expect(screen.getByText("Showing 1 of 3 tasks")).toBeInTheDocument();
  });

  test("refleja la combinación de tipo y búsqueda", async () => {
    await renderWith(three);
    await choose("Kind", "Snapshot");
    expect(screen.getByText("Showing 2 of 3 tasks")).toBeInTheDocument();
    search("documents");
    expect(screen.getByText("Showing 1 of 3 tasks")).toBeInTheDocument();
    expect(screen.getByText("Backup documents")).toBeInTheDocument();
  });

  test("sin coincidencias muestra un aviso en lugar de la tabla", async () => {
    await renderWith(three);
    search("zzz");
    expect(screen.getByText("Showing 0 of 3 tasks")).toBeInTheDocument();
    expect(screen.getByText("No tasks match the current filters.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  test("al quitar la búsqueda vuelve la tabla completa", async () => {
    await renderWith(three);
    search("zzz");
    search("");
    expect(screen.getByText("Showing 3 of 3 tasks")).toBeInTheDocument();
    expect(screen.queryByText("No tasks match the current filters.")).not.toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  test("se actualiza con el refresco periódico", async () => {
    await renderWith(three);
    axiosMock.onGet("/api/v1/tasks").reply(200, { tasks: [...three, task("t4", "Restore", "Restore files", "SUCCESS", 4)] });
    await triggerIntervals();
    await waitFor(() => expect(screen.getByText("Showing 4 of 4 tasks")).toBeInTheDocument());
  });
});
