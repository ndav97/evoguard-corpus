// Tests ocultos del estudio.
import { matchesResourceName } from "../ResourceNameFilter"

// T004 — Alternativas separadas por comas.
describe("T004 · alternativas con comas en el filtro por nombre", () => {
  it("una palabra con comas se cumple con cualquiera de sus alternativas", () => {
    expect(matchesResourceName("api-server", "api,web")).toBe(true)
    expect(matchesResourceName("web-frontend", "api,web")).toBe(true)
    expect(matchesResourceName("db", "api,web")).toBe(false)
  })

  it("en una exclusión se excluyen todas las alternativas", () => {
    expect(matchesResourceName("db", "-api,web")).toBe(true)
    expect(matchesResourceName("api-server", "-api,web")).toBe(false)
    expect(matchesResourceName("web-frontend", "-api,web")).toBe(false)
  })

  it("las palabras con alternativas se combinan con las demás", () => {
    expect(matchesResourceName("prod-web", "prod api,web")).toBe(true)
    expect(matchesResourceName("dev-web", "prod api,web")).toBe(false)
    expect(matchesResourceName("prod-db", "prod api,web")).toBe(false)
  })

  it("las alternativas vacías se ignoran", () => {
    expect(matchesResourceName("api-server", "api,")).toBe(true)
    expect(matchesResourceName("db", "api,")).toBe(false)
    expect(matchesResourceName("db", ",")).toBe(true)
    expect(matchesResourceName("db", "-,")).toBe(true)
    expect(matchesResourceName("db", "db ,")).toBe(true)
  })

  it("sigue sin distinguir mayúsculas y conserva lo anterior", () => {
    expect(matchesResourceName("API-Server", "web,api")).toBe(true)
    expect(matchesResourceName("web-api", "web -api")).toBe(false)
    expect(matchesResourceName("api", "api -")).toBe(true)
  })
})
