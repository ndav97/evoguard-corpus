// Tests ocultos del estudio.
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";
import SearchFilter, { ISearchFilterProps } from "components/SearchFilter/SearchFilter";

jest.useFakeTimers();

const makeProps = (overrides: Partial<ISearchFilterProps> = {}): ISearchFilterProps => ({
  value: "",
  placeholder: "search packages...",
  onChange: jest.fn(),
  submitFilters: jest.fn(),
  ...overrides,
});

const input = () => screen.getByRole("textbox", { name: "Search box" }) as HTMLInputElement;
const type = (value: string) => fireEvent.change(input(), { target: { value } });
const wait = (ms = 300) =>
  act(() => {
    jest.advanceTimersByTime(ms);
  });
const clearButton = () => screen.queryByRole("button", { name: "Clear search" });

// T003 — Botón para borrar la búsqueda.
describe("T003 · botón Clear search", () => {
  it("solo aparece cuando hay texto", () => {
    render(<SearchFilter {...makeProps()} />);
    expect(clearButton()).not.toBeInTheDocument();
    type("foo");
    expect(clearButton()).toBeInTheDocument();
  });

  it("vacía el campo, notifica de inmediato y devuelve el foco al campo", () => {
    const props = makeProps({ value: "foo" });
    render(<SearchFilter {...props} />);
    fireEvent.click(clearButton() as HTMLElement);
    expect(input().value).toBe("");
    expect(props.onChange).toHaveBeenCalledTimes(1);
    expect(props.onChange).toHaveBeenCalledWith("");
    expect(document.activeElement).toBe(input());
    expect(clearButton()).not.toBeInTheDocument();
  });

  it("cancela el cambio pendiente y no envía el formulario", () => {
    const props = makeProps();
    render(<SearchFilter {...props} />);
    type("foo");
    fireEvent.click(clearButton() as HTMLElement);
    wait();
    expect(props.onChange).toHaveBeenCalledTimes(1);
    expect(props.onChange).toHaveBeenLastCalledWith("");
    expect(props.submitFilters).not.toHaveBeenCalled();
  });

  it("Escape sigue vaciando la búsqueda", () => {
    const props = makeProps({ value: "foo" });
    render(<SearchFilter {...props} />);
    fireEvent.keyDown(input(), { key: "Escape" });
    expect(input().value).toBe("");
    expect(props.onChange).toHaveBeenCalledWith("");
    expect(clearButton()).not.toBeInTheDocument();
  });
});
