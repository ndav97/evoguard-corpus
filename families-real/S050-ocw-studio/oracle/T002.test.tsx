// Tests ocultos del estudio.
import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"

import BooleanField from "../components/widgets/BooleanField"

describe("T002 · allowUnset", () => {
  it("añade una tercera opción marcada cuando no hay valor", () => {
    render(
      <BooleanField name="hide" value={null} onChange={jest.fn()} allowUnset />,
    )
    const radios = screen.getAllByRole("radio")
    expect(radios).toHaveLength(3)
    const unset = screen.getByRole("radio", { name: "Not set" })
    expect(unset).toBeChecked()
    expect(unset).toHaveAttribute("id", "hide_unset")
    expect(unset).toHaveAttribute("value", "")
    expect(unset).toHaveAttribute("name", "hide")
    expect(radios[2]).toBe(unset)
  })

  it("undefined también cuenta como sin valor", () => {
    render(
      <BooleanField
        name="hide"
        value={undefined}
        onChange={jest.fn()}
        allowUnset
        unsetLabel="Sin decidir"
      />,
    )
    expect(screen.getByRole("radio", { name: "Sin decidir" })).toBeChecked()
  })

  it("elegirla informa de null, y las otras siguen informando booleanos", () => {
    const onChange = jest.fn()
    render(
      <BooleanField name="hide" value={true} onChange={onChange} allowUnset />,
    )
    expect(screen.getByRole("radio", { name: "Not set" })).not.toBeChecked()
    fireEvent.click(screen.getByRole("radio", { name: "Not set" }))
    expect(onChange).toHaveBeenLastCalledWith({
      target: { name: "hide", value: null },
    })
    fireEvent.click(screen.getByRole("radio", { name: "False" }))
    expect(onChange).toHaveBeenLastCalledWith({
      target: { name: "hide", value: false },
    })
  })

  it("sin allowUnset todo sigue igual", () => {
    render(<BooleanField name="b" value={null} onChange={jest.fn()} />)
    const radios = screen.getAllByRole("radio")
    expect(radios).toHaveLength(2)
    radios.forEach((radio) => expect(radio).not.toBeChecked())
  })

  it("las etiquetas propias se mantienen", () => {
    render(
      <BooleanField
        name="b"
        value={false}
        onChange={jest.fn()}
        allowUnset
        trueLabel="Sí"
        falseLabel="No"
      />,
    )
    expect(screen.getByRole("radio", { name: "No" })).toBeChecked()
    expect(screen.getByRole("radio", { name: "Sí" })).toHaveAttribute(
      "id",
      "b_true",
    )
  })
})
