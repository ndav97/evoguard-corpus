// Tests ocultos del estudio.
import React from "react"
import { render, screen, within } from "@testing-library/react"

import BooleanField from "../components/widgets/BooleanField"

describe("T004 · legend y description", () => {
  it("agrupa las opciones en un fieldset con su leyenda", () => {
    render(
      <BooleanField
        name="hide"
        value={false}
        onChange={jest.fn()}
        legend="Hide from course navigation?"
      />,
    )
    const group = screen.getByRole("group", {
      name: "Hide from course navigation?",
    })
    expect(group.tagName).toBe("FIELDSET")
    expect(group.firstElementChild?.tagName).toBe("LEGEND")
    expect(group.firstElementChild).toHaveClass("h6")
    expect(within(group).getAllByRole("radio")).toHaveLength(2)
    expect(group.hasAttribute("aria-describedby")).toBe(false)
    expect(group.querySelector("small")).toBeNull()
  })

  it("la descripción queda enlazada al grupo", () => {
    render(
      <BooleanField
        name="hide"
        value={false}
        onChange={jest.fn()}
        legend="Hide?"
        description="Hidden pages are still published."
      />,
    )
    const group = screen.getByRole("group", { name: "Hide?" })
    const help = screen.getByText("Hidden pages are still published.")
    expect(help.tagName).toBe("SMALL")
    expect(help).toHaveAttribute("id", "hide_description")
    expect(help).toHaveClass("form-text")
    expect(group).toHaveAttribute("aria-describedby", "hide_description")
    const radios = within(group).getAllByRole("radio")
    expect(
      radios[radios.length - 1].compareDocumentPosition(help) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it("desactivado, el fieldset se ve apagado", () => {
    render(
      <BooleanField
        name="b"
        value={null}
        onChange={jest.fn()}
        legend="Draft?"
        allowUnset
        disabled
      />,
    )
    const group = screen.getByRole("group", { name: "Draft?" })
    expect(group).toHaveClass("text-muted")
    within(group)
      .getAllByRole("radio")
      .forEach((radio) => expect(radio).toBeDisabled())
    expect(screen.getByRole("radio", { name: "Not set" })).toBeChecked()
  })

  it("sin legend no hay fieldset ni descripción", () => {
    const { container } = render(
      <BooleanField
        name="b"
        value={true}
        onChange={jest.fn()}
        description="No se muestra"
      />,
    )
    expect(container.querySelector("fieldset")).toBeNull()
    expect(screen.queryByText("No se muestra")).toBeNull()
    expect((container.firstChild as HTMLElement).tagName).toBe("DIV")
  })
})
