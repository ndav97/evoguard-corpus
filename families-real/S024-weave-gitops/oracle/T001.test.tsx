// Tests ocultos del estudio.
import { render, screen } from "@testing-library/react";
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

const isDisabled = (name: string) =>
  screen.getByLabelText(name).hasAttribute("disabled");

// T001 — Rango correcto con listas vacías y en la última página.
describe("T001 · rango mostrado", () => {
  it("muestra 0 - 0 cuando no hay objetos", () => {
    renderPagination({ index: 0, length: 0, totalObjects: 0 });
    expect(screen.getByText("0 - 0 out of 0")).toBeTruthy();
    expect(screen.queryByText(/1 - 0/)).toBeNull();
  });

  it("sin objetos los cuatro botones están deshabilitados", () => {
    renderPagination({ index: 0, length: 0, totalObjects: 0 });
    expect(isDisabled("skip to first page")).toBe(true);
    expect(isDisabled("back one page")).toBe(true);
    expect(isDisabled("forward one page")).toBe(true);
    expect(isDisabled("skip to last page")).toBe(true);
  });

  it("el final del rango no supera el total de objetos", () => {
    renderPagination({ index: 20, length: 10, totalObjects: 25 });
    expect(screen.getByText("21 - 25 out of 25")).toBeTruthy();
    expect(isDisabled("forward one page")).toBe(true);
  });

  it("en una página intermedia el rango no cambia", () => {
    renderPagination({ index: 25, length: 25, totalObjects: 80 });
    expect(screen.getByText("26 - 50 out of 80")).toBeTruthy();
    expect(isDisabled("back one page")).toBe(false);
    expect(isDisabled("forward one page")).toBe(false);
  });
});
