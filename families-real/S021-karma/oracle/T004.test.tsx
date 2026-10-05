// Tests ocultos del estudio.
import { render, screen, fireEvent } from "@testing-library/react";

import { InlineEdit } from "Components/InlineEdit";

// T004 — Nombre accesible con la prop label.
describe("T004 · etiqueta accesible", () => {
  it("con label, el texto es un botón con nombre accesible", () => {
    render(<InlineEdit value="foo" label="Filter" onChange={jest.fn()} />);
    const button = screen.getByRole("button", { name: "Edit Filter" });
    expect(button).toHaveTextContent("foo");
  });

  it("con label, el campo de edición tiene ese nombre accesible", () => {
    render(<InlineEdit value="foo" label="Filter" onChange={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit Filter" }));
    expect(screen.getByRole("textbox", { name: "Filter" })).toHaveValue("foo");
  });

  it("el botón se activa con la barra espaciadora", () => {
    const onEnterEditing = jest.fn();
    render(
      <InlineEdit
        value="foo"
        label="Filter"
        onChange={jest.fn()}
        onEnterEditing={onEnterEditing}
      />,
    );
    fireEvent.keyDown(screen.getByRole("button", { name: "Edit Filter" }), {
      key: " ",
      keyCode: 32,
    });
    expect(screen.getByRole("textbox", { name: "Filter" })).toHaveFocus();
    expect(onEnterEditing).toHaveBeenCalledTimes(1);
  });

  it("con label y placeholder, el botón muestra el placeholder", () => {
    render(
      <InlineEdit
        value=""
        label="Filter"
        placeholder="Add filter"
        onChange={jest.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Edit Filter" }),
    ).toHaveTextContent("Add filter");
  });

  it("sin label no hay rol de botón", () => {
    render(<InlineEdit value="foo" onChange={jest.fn()} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("foo")).not.toHaveAttribute("aria-label");
  });
});
