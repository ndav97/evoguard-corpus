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

// T001 — El campo sigue a la prop value.
describe("T001 · sincronizar con la prop value", () => {
  it("si el padre cambia value, el campo muestra el nuevo valor", () => {
    const props = makeProps({ value: "foo" });
    const { rerender } = render(<SearchFilter {...props} />);
    expect(input().value).toBe("foo");
    rerender(<SearchFilter {...props} value="bar" />);
    expect(input().value).toBe("bar");
  });

  it("descarta el cambio pendiente cuando el padre cambia value", () => {
    const props = makeProps({ value: "foo" });
    const { rerender } = render(<SearchFilter {...props} />);
    type("abc");
    rerender(<SearchFilter {...props} value="bar" />);
    wait();
    expect(props.onChange).not.toHaveBeenCalled();
    expect(input().value).toBe("bar");
  });

  it("después de sincronizar, escribir sigue notificando tras la espera", () => {
    const props = makeProps({ value: "foo" });
    const { rerender } = render(<SearchFilter {...props} />);
    rerender(<SearchFilter {...props} value="bar" />);
    type("baz");
    wait(299);
    expect(props.onChange).not.toHaveBeenCalled();
    wait(1);
    expect(props.onChange).toHaveBeenCalledTimes(1);
    expect(props.onChange).toHaveBeenCalledWith("baz");
  });

  it("un re-render sin cambiar value no borra lo escrito", () => {
    const props = makeProps({ value: "" });
    const { rerender } = render(<SearchFilter {...props} />);
    type("abc");
    rerender(<SearchFilter {...props} placeholder="search apps..." />);
    expect(input().value).toBe("abc");
    wait();
    expect(props.onChange).toHaveBeenCalledWith("abc");
  });
});
