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

// T003 — El foco vuelve al campo tras pulsar «Clear name filter».
describe("T003 · foco tras borrar el filtro", () => {
  it("al pulsar el botón de borrar, el foco pasa al campo", () => {
    renderWithFilter("wow")
    const input = screen.getByRole("textbox")

    userEvent.click(screen.getByLabelText("Clear name filter"))

    expect(input).toHaveValue("")
    expect(savedFilter()).toBe("")
    expect(input).toHaveFocus()
  })

  it("después de borrar se puede escribir directamente", () => {
    renderWithFilter("wow")
    const input = screen.getByRole("textbox")

    userEvent.click(screen.getByLabelText("Clear name filter"))
    userEvent.keyboard("db")

    expect(input).toHaveValue("db")
    expect(savedFilter()).toBe("db")
  })

  it("Escape sigue vaciando el filtro y deja el foco en el campo", () => {
    renderWithFilter("wow")
    const input = screen.getByRole("textbox")

    userEvent.type(input, "{esc}")

    expect(input).toHaveValue("")
    expect(input).toHaveFocus()
  })
})
