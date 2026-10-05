// Tests ocultos del estudio.
import { render, screen, fireEvent } from "@testing-library/react";

import { InlineEdit } from "Components/InlineEdit";

const edit = (text: string) => {
  fireEvent.click(screen.getByText(text));
  return screen.getByRole("textbox");
};
const type = (value: string) =>
  fireEvent.change(screen.getByRole("textbox"), { target: { value } });
const pressEnter = () =>
  fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter", keyCode: 13 });

// T002 — No notificar cuando el valor no cambia.
describe("T002 · sin cambios no se llama a onChange", () => {
  it("volver a escribir el mismo valor no llama a onChange", () => {
    const onChange = jest.fn();
    render(<InlineEdit value="foo" onChange={onChange} />);
    edit("foo");
    type("bar");
    type("foo");
    pressEnter();
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("el mismo valor con espacios alrededor tampoco cuenta como cambio", () => {
    const onChange = jest.fn();
    render(<InlineEdit value="foo" onChange={onChange} />);
    edit("foo");
    type("  foo  ");
    pressEnter();
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByText("foo")).toBeInTheDocument();
  });

  it("un valor distinto se guarda recortado", () => {
    const onChange = jest.fn();
    render(<InlineEdit value="foo" onChange={onChange} />);
    edit("foo");
    type("  foo=bar ");
    pressEnter();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("foo=bar");
  });

  it("vaciar el campo sigue llamando a onChange con cadena vacía", () => {
    const onChange = jest.fn();
    render(<InlineEdit value="foo" onChange={onChange} />);
    edit("foo");
    type("");
    pressEnter();
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("se mantiene la edición con el teclado", () => {
    render(<InlineEdit value="foo" onChange={jest.fn()} />);
    fireEvent.keyDown(screen.getByText("foo"), { key: "Enter", keyCode: 13 });
    expect(screen.getByRole("textbox")).toHaveValue("foo");
  });
});
