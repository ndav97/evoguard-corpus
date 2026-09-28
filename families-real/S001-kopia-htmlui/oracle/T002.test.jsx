import React from "react";
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
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

// T002 — Estados «Success» y «Canceled» en el filtro, y botón «Clear filters».
describe("T002 · más estados y «Clear filters»", () => {
  const tasks = [
    task("t1", "Snapshot", "Backup photos", "SUCCESS", 1),
    task("t2", "Maintenance", "Quick maintenance", "RUNNING", 2),
    task("t3", "Snapshot", "Backup documents", "FAILED", 3),
    task("t4", "Restore", "Restore music", "CANCELED", 4),
    task("t5", "Restore", "Restore videos", "CANCELING", 5),
  ];
  const clearButton = () => screen.queryByRole("button", { name: "Clear filters" });

  test("el filtro «Success» muestra solo las tareas terminadas con éxito", async () => {
    await renderWith(tasks);
    await choose("Status", "Success");
    expect(screen.getByText("Status: Success")).toBeInTheDocument();
    expect(screen.getByText("Backup photos")).toBeInTheDocument();
    expect(screen.queryByText("Quick maintenance")).not.toBeInTheDocument();
    expect(screen.queryByText("Backup documents")).not.toBeInTheDocument();
    expect(screen.getByText("Showing 1 of 5 tasks")).toBeInTheDocument();
  });

  test("el filtro «Canceled» muestra solo las canceladas (no las que se están cancelando)", async () => {
    await renderWith(tasks);
    await choose("Status", "Canceled");
    expect(screen.getByText("Restore music")).toBeInTheDocument();
    expect(screen.queryByText("Restore videos")).not.toBeInTheDocument();
    expect(screen.getByText("Showing 1 of 5 tasks")).toBeInTheDocument();
  });

  test("sin filtros activos no hay botón «Clear filters»", async () => {
    await renderWith(tasks);
    expect(clearButton()).not.toBeInTheDocument();
  });

  test("el botón aparece con cualquier filtro activo", async () => {
    await renderWith(tasks);
    await choose("Status", "Failed");
    expect(clearButton()).toBeInTheDocument();
    await choose("Status", "All");
    expect(clearButton()).not.toBeInTheDocument();
    await choose("Kind", "Restore");
    expect(clearButton()).toBeInTheDocument();
    await choose("Kind", "All");
    search("photos");
    expect(clearButton()).toBeInTheDocument();
  });

  test("«Clear filters» restablece estado, tipo y búsqueda", async () => {
    await renderWith(tasks);
    await choose("Status", "Failed");
    await choose("Kind", "Snapshot");
    search("documents");
    expect(screen.getByText("Showing 1 of 5 tasks")).toBeInTheDocument();

    await userEvent.click(clearButton());

    expect(screen.getByText("Status: All")).toBeInTheDocument();
    expect(screen.getByText("Kind: All")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("");
    expect(screen.getByText("Showing 5 of 5 tasks")).toBeInTheDocument();
    expect(clearButton()).not.toBeInTheDocument();
  });

  test("«Clear filters» recupera la tabla cuando no había coincidencias", async () => {
    await renderWith(tasks);
    search("zzz");
    expect(screen.getByText("No tasks match the current filters.")).toBeInTheDocument();
    await userEvent.click(clearButton());
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("Restore videos")).toBeInTheDocument();
  });
});
