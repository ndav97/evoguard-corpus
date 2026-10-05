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
const submit = () => fireEvent.submit(screen.getByRole("search"));

// T004 — Enviar aplica el texto pendiente.
describe("T004 · enviar aplica el cambio pendiente", () => {
  it("al enviar se notifica el texto pendiente antes de submitFilters", () => {
    const props = makeProps();
    render(<SearchFilter {...props} />);
    type("nginx");
    submit();
    expect(props.onChange).toHaveBeenCalledTimes(1);
    expect(props.onChange).toHaveBeenCalledWith("nginx");
    expect(props.submitFilters).toHaveBeenCalledTimes(1);
    const onChangeOrder = (props.onChange as jest.Mock).mock.invocationCallOrder[0];
    const submitOrder = (props.submitFilters as jest.Mock).mock.invocationCallOrder[0];
    expect(onChangeOrder).toBeLessThan(submitOrder);
  });

  it("el cambio no se vuelve a notificar al terminar la espera", () => {
    const props = makeProps();
    render(<SearchFilter {...props} />);
    type("nginx");
    submit();
    wait();
    expect(props.onChange).toHaveBeenCalledTimes(1);
  });

  it("sin cambio pendiente solo se llama a submitFilters", () => {
    const props = makeProps({ value: "foo" });
    render(<SearchFilter {...props} />);
    submit();
    expect(props.onChange).not.toHaveBeenCalled();
    expect(props.submitFilters).toHaveBeenCalledTimes(1);
  });

  it("si la espera ya terminó, enviar no repite la notificación", () => {
    const props = makeProps();
    render(<SearchFilter {...props} />);
    type("nginx");
    wait();
    submit();
    expect(props.onChange).toHaveBeenCalledTimes(1);
    expect(props.submitFilters).toHaveBeenCalledTimes(1);
  });

  it("el botón Clear search no envía el formulario", () => {
    const props = makeProps({ value: "foo" });
    render(<SearchFilter {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(props.submitFilters).not.toHaveBeenCalled();
    expect(props.onChange).toHaveBeenCalledWith("");
  });
});
