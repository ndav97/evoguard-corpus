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

// T005 — Espera configurable y sin avisos tras desmontar.
describe("T005 · espera configurable", () => {
  it("con debounceTime se espera ese tiempo", () => {
    const props = makeProps({ debounceTime: 1000 });
    render(<SearchFilter {...props} />);
    type("redis");
    wait(300);
    expect(props.onChange).not.toHaveBeenCalled();
    wait(700);
    expect(props.onChange).toHaveBeenCalledTimes(1);
    expect(props.onChange).toHaveBeenCalledWith("redis");
  });

  it("por defecto la espera sigue siendo de 300 ms", () => {
    const props = makeProps();
    render(<SearchFilter {...props} />);
    type("redis");
    wait(299);
    expect(props.onChange).not.toHaveBeenCalled();
    wait(1);
    expect(props.onChange).toHaveBeenCalledWith("redis");
  });

  it("al desmontar no se notifica el cambio pendiente", () => {
    const props = makeProps({ debounceTime: 500 });
    const { unmount } = render(<SearchFilter {...props} />);
    type("redis");
    unmount();
    wait(1000);
    expect(props.onChange).not.toHaveBeenCalled();
  });

  it("Escape y el envío siguen siendo inmediatos", () => {
    const props = makeProps({ debounceTime: 1000 });
    render(<SearchFilter {...props} />);
    type("redis");
    fireEvent.submit(screen.getByRole("search"));
    expect(props.onChange).toHaveBeenLastCalledWith("redis");
    fireEvent.keyDown(input(), { key: "Escape" });
    expect(props.onChange).toHaveBeenLastCalledWith("");
    wait(1000);
    expect(props.onChange).toHaveBeenCalledTimes(2);
  });
});
