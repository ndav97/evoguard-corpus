// Tests ocultos del estudio.
import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"

import BooleanField from "../components/widgets/BooleanField"
import { widgetExtraProps } from "../lib/site_content"
import { ConfigField, WidgetVariant } from "../types/websites"

const booleanField = (extra: Record<string, unknown> = {}) =>
  ({
    name: "draft",
    label: "Draft",
    widget: WidgetVariant.Boolean,
    ...extra,
  }) as ConfigField

describe("T001 · etiquetas de BooleanField", () => {
  it("usa las etiquetas recibidas como nombre de cada radio", () => {
    render(
      <BooleanField
        name="visible"
        value={true}
        onChange={jest.fn()}
        trueLabel="Visible"
        falseLabel="Oculto"
      />,
    )
    expect(screen.getByRole("radio", { name: "Visible" })).toBeChecked()
    expect(screen.getByRole("radio", { name: "Oculto" })).not.toBeChecked()
    expect(screen.queryByText("True")).toBeNull()
    expect(screen.getByRole("radio", { name: "Visible" })).toHaveAttribute(
      "id",
      "visible_true",
    )
  })

  it("sin etiquetas sigue mostrando True y False", () => {
    render(<BooleanField name="b" value={false} onChange={jest.fn()} />)
    expect(screen.getByRole("radio", { name: "True" })).not.toBeChecked()
    expect(screen.getByRole("radio", { name: "False" })).toBeChecked()
  })

  it("se puede cambiar solo una de las dos", () => {
    render(
      <BooleanField name="b" value={false} onChange={jest.fn()} trueLabel="Sí" />,
    )
    expect(screen.getByRole("radio", { name: "Sí" })).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "False" })).toBeInTheDocument()
  })

  it("el cambio sigue informando del valor booleano", () => {
    const onChange = jest.fn()
    render(
      <BooleanField
        name="b"
        value={false}
        onChange={onChange}
        trueLabel="Sí"
        falseLabel="No"
      />,
    )
    fireEvent.click(screen.getByRole("radio", { name: "Sí" }))
    expect(onChange).toHaveBeenCalledWith({ target: { name: "b", value: true } })
  })

  it("widgetExtraProps pasa las etiquetas configuradas", () => {
    expect(
      widgetExtraProps(booleanField({ true_label: "Sí", false_label: "No" })),
    ).toStrictEqual({ trueLabel: "Sí", falseLabel: "No" })
    expect(widgetExtraProps(booleanField({ true_label: "Sí" }))).toStrictEqual({
      trueLabel: "Sí",
    })
    expect(widgetExtraProps(booleanField())).toStrictEqual({})
  })
})
