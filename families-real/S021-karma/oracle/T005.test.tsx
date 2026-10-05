// Tests ocultos del estudio.
import { render, screen, fireEvent } from "@testing-library/react";

import { InlineEdit } from "Components/InlineEdit";

const type = (value: string) =>
  fireEvent.change(screen.getByRole("textbox"), { target: { value } });
const pressKey = (key: string, keyCode: number) =>
  fireEvent.keyDown(screen.getByRole("textbox"), { key, keyCode });

const needsOperator = (value: string) =>
  value.includes("=") ? undefined : "Missing operator";

// T005 — Validación antes de guardar.
describe("T005 · validación", () => {
  it("un valor no válido no se guarda y muestra el error", () => {
    const onChange = jest.fn();
    render(
      <InlineEdit value="foo=bar" onChange={onChange} validate={needsOperator} />,
    );
    fireEvent.click(screen.getByText("foo=bar"));
    type("foo");
    pressKey("Enter", 13);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox")).toHaveValue("foo");
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Missing operator");
  });

  it("al escribir desaparece el error", () => {
    render(
      <InlineEdit value="foo=bar" onChange={jest.fn()} validate={needsOperator} />,
    );
    fireEvent.click(screen.getByText("foo=bar"));
    type("foo");
    pressKey("Enter", 13);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    type("foo=");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox")).not.toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("un valor válido se guarda; validate recibe el valor recortado", () => {
    const onChange = jest.fn();
    const validate = jest.fn(needsOperator);
    render(<InlineEdit value="foo=bar" onChange={onChange} validate={validate} />);
    fireEvent.click(screen.getByText("foo=bar"));
    type("  foo=baz ");
    pressKey("Enter", 13);
    expect(validate).toHaveBeenCalledWith("foo=baz");
    expect(onChange).toHaveBeenCalledWith("foo=baz");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("vaciar el campo también se valida", () => {
    const onChange = jest.fn();
    const validate = jest.fn((value: string) =>
      value === "" ? "Value is required" : undefined,
    );
    render(<InlineEdit value="foo=bar" onChange={onChange} validate={validate} />);
    fireEvent.click(screen.getByText("foo=bar"));
    type("");
    pressKey("Enter", 13);
    expect(validate).toHaveBeenCalledWith("");
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Value is required");
  });

  it("sin cambios no se valida", () => {
    const onChange = jest.fn();
    const validate = jest.fn(() => "Always invalid");
    render(<InlineEdit value="foo=bar" onChange={onChange} validate={validate} />);
    fireEvent.click(screen.getByText("foo=bar"));
    type(" foo=bar ");
    pressKey("Enter", 13);
    expect(validate).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("Escape descarta el error y la edición", () => {
    const onChange = jest.fn();
    render(
      <InlineEdit value="foo=bar" onChange={onChange} validate={needsOperator} />,
    );
    fireEvent.click(screen.getByText("foo=bar"));
    type("foo");
    pressKey("Enter", 13);
    pressKey("Escape", 27);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("foo=bar"));
    expect(screen.getByRole("textbox")).toHaveValue("foo=bar");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});
