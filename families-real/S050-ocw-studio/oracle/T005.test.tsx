// Tests ocultos del estudio.
import React from "react"
import { act, fireEvent, render, screen } from "@testing-library/react"

import BooleanField from "../components/widgets/BooleanField"

const flush = () =>
  act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })

describe("T005 · confirmChange", () => {
  it("con confirmación síncrona positiva llama a onChange", async () => {
    const onChange = jest.fn()
    const confirmChange = jest.fn(() => true)
    render(
      <BooleanField
        name="hide"
        value={false}
        onChange={onChange}
        confirmChange={confirmChange}
      />,
    )
    fireEvent.click(screen.getByRole("radio", { name: "True" }))
    await flush()
    expect(confirmChange).toHaveBeenCalledWith(true)
    expect(onChange).toHaveBeenCalledWith({
      target: { name: "hide", value: true },
    })
  })

  it("si se niega no llama a onChange", async () => {
    const onChange = jest.fn()
    render(
      <BooleanField
        name="hide"
        value={false}
        onChange={onChange}
        confirmChange={() => false}
      />,
    )
    fireEvent.click(screen.getByRole("radio", { name: "True" }))
    await flush()
    expect(onChange).not.toHaveBeenCalled()
  })

  it("espera la promesa y desactiva las opciones mientras tanto", async () => {
    const onChange = jest.fn()
    let resolve: (value: boolean) => void = () => undefined
    const confirmChange = jest.fn(
      () =>
        new Promise<boolean>((r) => {
          resolve = r
        }),
    )
    const { container } = render(
      <BooleanField
        name="hide"
        value={true}
        onChange={onChange}
        confirmChange={confirmChange}
        allowUnset
      />,
    )
    fireEvent.click(screen.getByRole("radio", { name: "Not set" }))
    await flush()
    expect(confirmChange).toHaveBeenCalledWith(null)
    expect(onChange).not.toHaveBeenCalled()
    screen.getAllByRole("radio").forEach((radio) => expect(radio).toBeDisabled())
    expect(container.firstChild).toHaveAttribute("aria-busy", "true")

    await act(async () => {
      resolve(true)
    })
    await flush()
    expect(onChange).toHaveBeenCalledWith({
      target: { name: "hide", value: null },
    })
    screen
      .getAllByRole("radio")
      .forEach((radio) => expect(radio).not.toBeDisabled())
    expect((container.firstChild as HTMLElement).hasAttribute("aria-busy")).toBe(
      false,
    )
  })

  it("una promesa rechazada cuenta como no", async () => {
    const onChange = jest.fn()
    render(
      <BooleanField
        name="hide"
        value={false}
        onChange={onChange}
        legend="Hide?"
        confirmChange={() => Promise.reject(new Error("cancelado"))}
      />,
    )
    fireEvent.click(screen.getByRole("radio", { name: "True" }))
    await flush()
    await flush()
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole("radio", { name: "True" })).not.toBeDisabled()
  })

  it("sin confirmChange el cambio es inmediato, y disabled no pregunta", () => {
    const onChange = jest.fn()
    const confirmChange = jest.fn(() => true)
    const { unmount } = render(
      <BooleanField name="b" value={false} onChange={onChange} />,
    )
    fireEvent.click(screen.getByRole("radio", { name: "True" }))
    expect(onChange).toHaveBeenCalledTimes(1)
    unmount()
    render(
      <BooleanField
        name="c"
        value={false}
        onChange={onChange}
        confirmChange={confirmChange}
        disabled
      />,
    )
    fireEvent.click(screen.getByRole("radio", { name: "True" }))
    expect(confirmChange).not.toHaveBeenCalled()
  })
})
