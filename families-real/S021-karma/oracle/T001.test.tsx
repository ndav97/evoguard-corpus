// Tests ocultos del estudio.
import { render, screen, fireEvent } from "@testing-library/react";

import { InlineEdit } from "Components/InlineEdit";

// T001 — Entrar en edición con el teclado.
describe("T001 · editar con el teclado", () => {
  it("Enter sobre el texto entra en edición con el foco en el campo", () => {
    render(<InlineEdit value="foo" onChange={jest.fn()} />);
    fireEvent.keyDown(screen.getByText("foo"), { key: "Enter", keyCode: 13 });
    const input = screen.getByRole("textbox");
    expect(input).toHaveValue("foo");
    expect(input).toHaveFocus();
  });

  it("la barra espaciadora entra en edición y llama a onEnterEditing", () => {
    const onEnterEditing = jest.fn();
    render(
      <InlineEdit
        value="foo"
        onChange={jest.fn()}
        onEnterEditing={onEnterEditing}
      />,
    );
    fireEvent.keyDown(screen.getByText("foo"), { key: " ", keyCode: 32 });
    expect(screen.getByRole("textbox")).toHaveValue("foo");
    expect(onEnterEditing).toHaveBeenCalledTimes(1);
  });

  it("las demás teclas no entran en edición", () => {
    const onEnterEditing = jest.fn();
    render(
      <InlineEdit
        value="foo"
        onChange={jest.fn()}
        onEnterEditing={onEnterEditing}
      />,
    );
    fireEvent.keyDown(screen.getByText("foo"), { key: "a", keyCode: 65 });
    fireEvent.keyDown(screen.getByText("foo"), {
      key: "ArrowDown",
      keyCode: 40,
    });
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(onEnterEditing).not.toHaveBeenCalled();
  });

  it("tras entrar con el teclado, Enter guarda el nuevo valor", () => {
    const onChange = jest.fn();
    render(<InlineEdit value="foo" onChange={onChange} />);
    fireEvent.keyDown(screen.getByText("foo"), { key: "Enter", keyCode: 13 });
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "bar" } });
    fireEvent.keyDown(screen.getByRole("textbox"), {
      key: "Enter",
      keyCode: 13,
    });
    expect(onChange).toHaveBeenCalledWith("bar");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
