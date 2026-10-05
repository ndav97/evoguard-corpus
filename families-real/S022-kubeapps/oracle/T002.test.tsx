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
const pressKey = (key: string) => fireEvent.keyDown(input(), { key });

// T002 — Escape vacía la búsqueda.
describe("T002 · Escape vacía la búsqueda", () => {
  it("Escape vacía el campo y notifica de inmediato", () => {
    const props = makeProps({ value: "foo" });
    render(<SearchFilter {...props} />);
    pressKey("Escape");
    expect(input().value).toBe("");
    expect(props.onChange).toHaveBeenCalledTimes(1);
    expect(props.onChange).toHaveBeenCalledWith("");
  });

  it("Escape cancela el cambio pendiente", () => {
    const props = makeProps();
    render(<SearchFilter {...props} />);
    type("foo");
    pressKey("Escape");
    wait();
    expect(props.onChange).toHaveBeenCalledTimes(1);
    expect(props.onChange).toHaveBeenLastCalledWith("");
    expect(input().value).toBe("");
  });

  it("con el campo vacío, Escape no hace nada", () => {
    const props = makeProps();
    render(<SearchFilter {...props} />);
    pressKey("Escape");
    wait();
    expect(props.onChange).not.toHaveBeenCalled();
  });

  it("las demás teclas no vacían el campo", () => {
    const props = makeProps({ value: "foo" });
    render(<SearchFilter {...props} />);
    pressKey("a");
    pressKey("Enter");
    expect(input().value).toBe("foo");
    expect(props.onChange).not.toHaveBeenCalled();
  });

  it("se mantiene la sincronización con value", () => {
    const props = makeProps({ value: "foo" });
    const { rerender } = render(<SearchFilter {...props} />);
    rerender(<SearchFilter {...props} value="bar" />);
    expect(input().value).toBe("bar");
  });
});
