import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "fs";
import { resolve } from "path";
import { LabelEditor } from "../components/dashboard/aliases/LabelEditor";
import { byMsgId } from "../../__mocks__/hooks/l10n";

const input = () =>
  screen.getByRole("textbox", { name: byMsgId("profile-label-edit-2") });
const ftl = () =>
  readFileSync(resolve(__dirname, "../../pendingTranslations.ftl"), "utf8");

const counter = () =>
  screen.queryByText(byMsgId("profile-label-characters-remaining"));

// T001 — Contador de caracteres restantes cerca del límite.
describe("T001 · contador de caracteres de la etiqueta", () => {
  it("no aparece lejos del límite", async () => {
    render(<LabelEditor label="" onSubmit={jest.fn()} />);
    await userEvent.type(input(), "a".repeat(39));
    expect(counter()).not.toBeInTheDocument();
  });

  it("aparece al quedar 10 caracteres o menos, con la cifra como número", async () => {
    render(<LabelEditor label="" onSubmit={jest.fn()} />);
    await userEvent.type(input(), "a".repeat(40));
    expect(counter()?.textContent).toContain('"remaining":10');
  });

  it("se actualiza mientras se escribe", async () => {
    render(<LabelEditor label="" onSubmit={jest.fn()} />);
    await userEvent.type(input(), "a".repeat(45));
    expect(counter()?.textContent).toContain('"remaining":5');
  });

  it("tiene en cuenta la etiqueta inicial", () => {
    render(<LabelEditor label={"b".repeat(48)} onSubmit={jest.fn()} />);
    expect(counter()?.textContent).toContain('"remaining":2');
  });

  it("la cadena está en pendingTranslations.ftl con la variable $remaining", () => {
    expect(ftl()).toMatch(
      /^profile-label-characters-remaining = .*\{ ?\$remaining ?\}/m,
    );
  });
});
