// Tests ocultos del estudio.
import { render, screen, fireEvent } from "@testing-library/react";

import { InlineEdit } from "Components/InlineEdit";

// T003 — Texto de ayuda cuando el valor está vacío.
describe("T003 · placeholder", () => {
  it("con valor vacío se muestra el placeholder", () => {
    render(<InlineEdit value="" placeholder="Add filter" onChange={jest.fn()} />);
    expect(screen.getByText("Add filter")).toBeInTheDocument();
  });

  it("al editar, el campo está vacío y lleva el placeholder", () => {
    render(<InlineEdit value="" placeholder="Add filter" onChange={jest.fn()} />);
    fireEvent.click(screen.getByText("Add filter"));
    const input = screen.getByRole("textbox");
    expect(input).toHaveValue("");
    expect(input).toHaveAttribute("placeholder", "Add filter");
  });

  it("con valor no se muestra el placeholder como texto", () => {
    render(
      <InlineEdit value="foo" placeholder="Add filter" onChange={jest.fn()} />,
    );
    expect(screen.getByText("foo")).toBeInTheDocument();
    expect(screen.queryByText("Add filter")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("foo"));
    expect(screen.getByRole("textbox")).toHaveValue("foo");
    expect(screen.getByRole("textbox")).toHaveAttribute(
      "placeholder",
      "Add filter",
    );
  });

  it("se puede entrar con el teclado desde el placeholder y guardar", () => {
    const onChange = jest.fn();
    render(<InlineEdit value="" placeholder="Add filter" onChange={onChange} />);
    fireEvent.keyDown(screen.getByText("Add filter"), {
      key: "Enter",
      keyCode: 13,
    });
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: " job=api " },
    });
    fireEvent.keyDown(screen.getByRole("textbox"), {
      key: "Enter",
      keyCode: 13,
    });
    expect(onChange).toHaveBeenCalledWith("job=api");
  });

  it("sin placeholder el comportamiento no cambia", () => {
    const onChange = jest.fn();
    render(<InlineEdit value="foo" onChange={onChange} />);
    fireEvent.click(screen.getByText("foo"));
    expect(screen.getByRole("textbox")).not.toHaveAttribute("placeholder");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: " foo" } });
    fireEvent.keyDown(screen.getByRole("textbox"), {
      key: "Enter",
      keyCode: 13,
    });
    expect(onChange).not.toHaveBeenCalled();
  });
});
