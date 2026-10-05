// Tests ocultos del estudio.
import { fireEvent, render, screen, within } from "@testing-library/react";
import "jest-styled-components";
import React from "react";
import Pagination, { Props } from "../components/Pagination";
import { withTheme } from "../lib/test-utils";

const makeProps = (overrides: Partial<Props> = {}): Props => ({
  onForward: jest.fn(),
  onSkipForward: jest.fn(),
  onBack: jest.fn(),
  onSkipBack: jest.fn(),
  onSelect: jest.fn(),
  index: 0,
  length: 0,
  totalObjects: 0,
  ...overrides,
});

const openRowsPerPage = (current: string) => {
  const matches = screen.getAllByText(current);
  fireEvent.mouseDown(matches[matches.length - 1]);
  return screen.getByRole("listbox");
};

// T003 — Filas por página controladas desde fuera.
describe("T003 · prop perPage", () => {
  it("el selector y el indicador usan perPage", () => {
    render(
      withTheme(
        <Pagination
          {...makeProps({ perPage: 50, index: 50, length: 50, totalObjects: 120 })}
        />,
      ),
    );
    expect(screen.getByText("50")).toBeTruthy();
    expect(screen.queryByText("25")).toBeNull();
    expect(screen.getByText("Page 2 of 3")).toBeTruthy();
  });

  it("elegir una opción avisa con onSelect pero manda el valor de perPage", () => {
    const props = makeProps({
      perPage: 50,
      index: 50,
      length: 50,
      totalObjects: 120,
    });
    render(withTheme(<Pagination {...props} />));
    fireEvent.click(within(openRowsPerPage("50")).getByText("75"));
    expect(props.onSelect).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Page 2 of 3")).toBeTruthy();
  });

  it("sigue los cambios de perPage del componente padre", () => {
    const props = makeProps({ perPage: 50, length: 50, totalObjects: 120 });
    const { rerender } = render(withTheme(<Pagination {...props} />));
    expect(screen.getByText("Page 1 of 3")).toBeTruthy();
    rerender(withTheme(<Pagination {...props} perPage={75} />));
    expect(screen.getByText("Page 1 of 2")).toBeTruthy();
    expect(screen.getByText("75")).toBeTruthy();
  });

  it("un perPage que no está entre las opciones se añade en orden", () => {
    render(
      withTheme(
        <Pagination
          {...makeProps({ perPage: 30, index: 30, length: 30, totalObjects: 100 })}
        />,
      ),
    );
    expect(screen.getByText("Page 2 of 4")).toBeTruthy();
    const options = Array.from(openRowsPerPage("30").children).map(
      (option) => option.textContent,
    );
    expect(options).toEqual(["25", "30", "50", "75", "100"]);
  });

  it("sin perPage el selector sigue funcionando como antes", () => {
    const props = makeProps({ index: 0, length: 25, totalObjects: 80 });
    render(withTheme(<Pagination {...props} />));
    fireEvent.click(within(openRowsPerPage("25")).getByText("50"));
    expect(props.onSelect).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Page 1 of 2")).toBeTruthy();
  });
});
