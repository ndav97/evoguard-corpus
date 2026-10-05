// Tests ocultos del estudio.
import { fireEvent, render, screen, within } from "@testing-library/react";
import "jest-styled-components";
import React from "react";
import Pagination, { Props } from "../components/Pagination";
import { withTheme } from "../lib/test-utils";

const renderPagination = (overrides: Partial<Props> = {}) => {
  const props: Props = {
    onForward: jest.fn(),
    onSkipForward: jest.fn(),
    onBack: jest.fn(),
    onSkipBack: jest.fn(),
    onSelect: jest.fn(),
    index: 0,
    length: 0,
    totalObjects: 0,
    ...overrides,
  };
  render(withTheme(<Pagination {...props} />));
  return props;
};

const chooseRowsPerPage = (current: string, next: string) => {
  const matches = screen.getAllByText(current);
  fireEvent.mouseDown(matches[matches.length - 1]);
  fireEvent.click(within(screen.getByRole("listbox")).getByText(next));
};

// T002 — Indicador de página.
describe("T002 · indicador de página", () => {
  it("muestra la primera página con las filas por página por defecto", () => {
    renderPagination({ index: 0, length: 25, totalObjects: 80 });
    expect(screen.getByText("Page 1 of 4")).toBeTruthy();
  });

  it("calcula la página actual a partir del índice", () => {
    renderPagination({ index: 50, length: 25, totalObjects: 80 });
    expect(screen.getByText("Page 3 of 4")).toBeTruthy();
    expect(screen.getByText("51 - 75 out of 80")).toBeTruthy();
  });

  it("una lista vacía tiene una única página", () => {
    renderPagination({ index: 0, length: 0, totalObjects: 0 });
    expect(screen.getByText("Page 1 of 1")).toBeTruthy();
  });

  it("usa la primera de las opciones de filas por página recibidas", () => {
    renderPagination({
      perPageOptions: [10, 20],
      index: 10,
      length: 10,
      totalObjects: 35,
    });
    expect(screen.getByText("Page 2 of 4")).toBeTruthy();
  });

  it("se actualiza al elegir otro número de filas por página", () => {
    const props = renderPagination({ index: 0, length: 25, totalObjects: 80 });
    chooseRowsPerPage("25", "50");
    expect(props.onSelect).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Page 1 of 2")).toBeTruthy();
  });
});
