// Tests ocultos del estudio.
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import React from "react"
import { MemoryRouter } from "react-router"
import { accessorsForTesting, tiltfileKeyContext } from "../BrowserStorage"
import {
  DEFAULT_OPTIONS,
  ResourceListOptions,
  ResourceListOptionsProvider,
  RESOURCE_LIST_OPTIONS_KEY,
} from "../ResourceListOptionsContext"
import { ResourceNameFilter } from "../ResourceNameFilter"

const resourceListOptionsAccessor = accessorsForTesting<ResourceListOptions>(
  RESOURCE_LIST_OPTIONS_KEY,
  sessionStorage
)

function customRender(component: JSX.Element) {
  return render(component, {
    wrapper: ({ children }) => (
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <tiltfileKeyContext.Provider value="test">
          <ResourceListOptionsProvider>{children}</ResourceListOptionsProvider>
        </tiltfileKeyContext.Provider>
      </MemoryRouter>
    ),
  })
}

function renderWithFilter(resourceNameFilter: string) {
  resourceListOptionsAccessor.set({ ...DEFAULT_OPTIONS, resourceNameFilter })
  return customRender(<ResourceNameFilter />)
}

const savedFilter = () => resourceListOptionsAccessor.get()?.resourceNameFilter

beforeEach(() => {
  sessionStorage.clear()
  localStorage.clear()
})

afterEach(() => {
  sessionStorage.clear()
  localStorage.clear()
})

// T002 — Escape vacía el filtro.
describe("T002 · borrar el filtro con Escape", () => {
  it("Escape vacía un filtro guardado y quita el botón de borrar", () => {
    renderWithFilter("wow")
    const input = screen.getByRole("textbox")
    expect(screen.getByLabelText("Clear name filter")).toBeInTheDocument()

    userEvent.type(input, "{esc}")

    expect(input).toHaveValue("")
    expect(savedFilter()).toBe("")
    expect(screen.queryByLabelText("Clear name filter")).toBeNull()
  })

  it("Escape vacía lo que se acaba de escribir", () => {
    customRender(<ResourceNameFilter />)
    const input = screen.getByRole("textbox")

    userEvent.type(input, "api")
    expect(savedFilter()).toBe("api")
    userEvent.type(input, "{esc}")

    expect(input).toHaveValue("")
    expect(savedFilter()).toBe("")
  })

  it("las demás teclas siguen escribiendo", () => {
    customRender(<ResourceNameFilter />)
    const input = screen.getByRole("textbox")

    userEvent.type(input, "web -db")

    expect(input).toHaveValue("web -db")
    expect(savedFilter()).toBe("web -db")
  })
})
