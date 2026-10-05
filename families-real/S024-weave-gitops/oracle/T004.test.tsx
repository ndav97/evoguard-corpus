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

const goTo = (value: string) => {
  fireEvent.change(screen.getByLabelText("Page number"), {
    target: { value },
  });
  fireEvent.click(screen.getByRole("button", { name: "Go" }));
};

// T004 — Ir a una página concreta.
describe("T004 · ir a una página", () => {
  it("sin onGoToPage no se muestra el campo", () => {
    renderPagination();
    expect(screen.queryByLabelText("Page number")).toBeNull();
    expect(screen.queryByRole("button", { name: "Go" })).toBeNull();
  });

  it("llama a onGoToPage con la página escrita", () => {
    const onGoToPage = jest.fn();
    renderPagination({ onGoToPage });
    goTo("3");
    expect(onGoToPage).toHaveBeenCalledWith(3);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("rechaza una página fuera de rango y avisa", () => {
    const onGoToPage = jest.fn();
    renderPagination({ onGoToPage });
    goTo("5");
    expect(onGoToPage).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe(
      "Enter a page between 1 and 4",
    );
  });

  it("rechaza 0, decimales y el campo vacío", () => {
    const onGoToPage = jest.fn();
    renderPagination({ onGoToPage });
    goTo("0");
    expect(screen.getByRole("alert")).toBeTruthy();
    goTo("2.5");
    expect(screen.getByRole("alert")).toBeTruthy();
    goTo("");
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(onGoToPage).not.toHaveBeenCalled();
  });

  it("el aviso desaparece tras ir a una página válida", () => {
    const onGoToPage = jest.fn();
    renderPagination({ onGoToPage });
    goTo("9");
    expect(screen.getByRole("alert")).toBeTruthy();
    goTo("4");
    expect(onGoToPage).toHaveBeenCalledWith(4);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("el límite usa las filas por página de perPage", () => {
    const onGoToPage = jest.fn();
    renderPagination({ onGoToPage, perPage: 50, totalObjects: 120 });
    goTo("4");
    expect(onGoToPage).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe(
      "Enter a page between 1 and 3",
    );
  });
});
