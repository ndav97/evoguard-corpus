// Tests ocultos del estudio.
import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"

import BooleanField from "../components/widgets/BooleanField"

describe("T003 · disabled", () => {
  it("desactiva todas las opciones y conserva la marcada", () => {
    render(
      <BooleanField
        name="b"
        value={true}
        onChange={jest.fn()}
        allowUnset
        disabled
      />,
    )
    const radios = screen.getAllByRole("radio")
    expect(radios).toHaveLength(3)
    radios.forEach((radio) => expect(radio).toBeDisabled())
    expect(screen.getByRole("radio", { name: "True" })).toBeChecked()
  })

  it("no llama a onChange aunque llegue un evento de cambio", () => {
    const onChange = jest.fn()
    render(
      <BooleanField name="b" value={true} onChange={onChange} disabled />,
    )
    const no = screen.getByRole("radio", { name: "False" })
    fireEvent.click(no)
    fireEvent.change(no, { target: { checked: true } })
    expect(onChange).not.toHaveBeenCalled()
  })

  it("el contenedor se ve apagado solo si está desactivado", () => {
    const { container, unmount } = render(
      <BooleanField name="b" value={false} onChange={jest.fn()} disabled />,
    )
    expect((container.firstChild as HTMLElement).className).toBe("text-muted")
    unmount()
    const other = render(
      <BooleanField name="c" value={false} onChange={jest.fn()} />,
    )
    expect((other.container.firstChild as HTMLElement).hasAttribute("class")).toBe(
      false,
    )
    screen.getAllByRole("radio").forEach((radio) => expect(radio).not.toBeDisabled())
  })

  it("las etiquetas propias se mantienen", () => {
    render(
      <BooleanField
        name="b"
        value={false}
        onChange={jest.fn()}
        disabled
        falseLabel="No"
      />,
    )
    expect(screen.getByRole("radio", { name: "No" })).toBeChecked()
  })
})
