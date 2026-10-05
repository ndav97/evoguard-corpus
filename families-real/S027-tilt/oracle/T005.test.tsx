// Tests ocultos del estudio.
import { matchesResourceName } from "../ResourceNameFilter"

// T005 — Mayúsculas solo cuando el filtro las usa.
describe("T005 · distinguir mayúsculas según el filtro", () => {
  it("una palabra con mayúsculas distingue mayúsculas", () => {
    expect(matchesResourceName("Worker", "Worker")).toBe(true)
    expect(matchesResourceName("worker-db", "Worker")).toBe(false)
  })

  it("una palabra en minúsculas sigue sin distinguirlas", () => {
    expect(matchesResourceName("Worker", "worker")).toBe(true)
    expect(matchesResourceName("worker-db", "worker")).toBe(true)
  })

  it("se decide por separado para cada alternativa", () => {
    expect(matchesResourceName("Api-server", "Api,web")).toBe(true)
    expect(matchesResourceName("WEB-frontend", "Api,web")).toBe(true)
    expect(matchesResourceName("api-server", "Api,web")).toBe(false)
  })

  it("se aplica también a las exclusiones", () => {
    expect(matchesResourceName("api-server", "-Api")).toBe(true)
    expect(matchesResourceName("Api-server", "-Api")).toBe(false)
  })

  it("se decide por separado para cada palabra", () => {
    expect(matchesResourceName("Worker-db", "Worker db")).toBe(true)
    expect(matchesResourceName("Worker-DB", "Worker db")).toBe(true)
    expect(matchesResourceName("worker-db", "Worker db")).toBe(false)
  })
})
