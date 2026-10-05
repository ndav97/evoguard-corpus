// Tests ocultos del estudio.
import { fireEvent, render, screen } from "@testing-library/react";
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
    length: 25,
    totalObjects: 80,
    ...overrides,
  };
  render(withTheme(<Pagination {...props} />));
  return props;
};

const typePage = (value: string) =>
  fireEvent.change(screen.getByLabelText("Page number"), {
    target: { value },
  });

// T005 — Separadores de miles y Enter para ir a una página.
describe("T005 · números legibles y teclado", () => {
  it("el rango usa separadores de miles", () => {
    renderPagination({ index: 25000, length: 25, totalObjects: 30000 });
    expect(screen.getByText("25,001 - 25,025 out of 30,000")).toBeTruthy();
  });

  it("el indicador de página usa separadores de miles", () => {
    renderPagination({ index: 25000, length: 25, totalObjects: 30000 });
    expect(screen.getByText("Page 1,001 of 1,200")).toBeTruthy();
  });

  it("los números pequeños no cambian", () => {
    renderPagination({ index: 50, length: 25, totalObjects: 80 });
    expect(screen.getByText("51 - 75 out of 80")).toBeTruthy();
    expect(screen.getByText("Page 3 of 4")).toBeTruthy();
  });

  it("el aviso de página no válida usa separadores de miles", () => {
    renderPagination({ onGoToPage: jest.fn(), totalObjects: 30000 });
    typePage("1201");
    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(screen.getByRole("alert").textContent).toBe(
      "Enter a page between 1 and 1,200",
    );
  });

  it("pulsar Enter en el campo equivale a pulsar Go", () => {
    const onGoToPage = jest.fn();
    renderPagination({ onGoToPage, totalObjects: 30000 });
    typePage("1200");
    fireEvent.keyDown(screen.getByLabelText("Page number"), { key: "Enter" });
    expect(onGoToPage).toHaveBeenCalledWith(1200);
  });

  it("Enter con una página no válida muestra el aviso", () => {
    const onGoToPage = jest.fn();
    renderPagination({ onGoToPage });
    typePage("7");
    fireEvent.keyDown(screen.getByLabelText("Page number"), { key: "Enter" });
    expect(onGoToPage).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe(
      "Enter a page between 1 and 4",
    );
  });
});
