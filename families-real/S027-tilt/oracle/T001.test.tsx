// Tests ocultos del estudio.
import { matchesResourceName } from "../ResourceNameFilter"

// T001 — Exclusiones con «-» en el filtro por nombre.
describe("T001 · exclusiones en el filtro por nombre", () => {
  it("una palabra con «-» deja fuera los nombres que la contienen", () => {
    expect(matchesResourceName("web-api", "-api")).toBe(false)
    expect(matchesResourceName("db", "-api")).toBe(true)
  })

  it("las exclusiones se combinan con las palabras normales", () => {
    expect(matchesResourceName("web-frontend", "web -api")).toBe(true)
    expect(matchesResourceName("web-api", "web -api")).toBe(false)
    expect(matchesResourceName("db", "web -api")).toBe(false)
  })

  it("las exclusiones no distinguen mayúsculas", () => {
    expect(matchesResourceName("Web-API", "-api")).toBe(false)
    expect(matchesResourceName("Web-Frontend", "web -api")).toBe(true)
  })

  it("un «-» suelto se ignora", () => {
    expect(matchesResourceName("api", "api -")).toBe(true)
    expect(matchesResourceName("db", "api -")).toBe(false)
  })

  it("los guiones dentro de una palabra y el filtro vacío no cambian", () => {
    expect(matchesResourceName("web-api", "web-api")).toBe(true)
    expect(matchesResourceName("web", "web-api")).toBe(false)
    expect(matchesResourceName("anything", "   ")).toBe(true)
    expect(matchesResourceName("My-Service", "service my")).toBe(true)
  })
})
