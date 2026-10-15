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

const saveError = () => screen.queryByRole("alert");

// T005 — Aviso cuando no se puede guardar la etiqueta.
describe("T005 · error al guardar", () => {
  it("si el guardado falla, avisa y vuelve a la etiqueta anterior", async () => {
    const onSubmit = jest.fn().mockRejectedValue(new Error("offline"));
    render(<LabelEditor label="Work" onSubmit={onSubmit} />);
    await userEvent.clear(input());
    await userEvent.type(input(), "Travel{Enter}");
    expect(onSubmit).toHaveBeenCalledWith("Travel");
    expect(await screen.findByRole("alert")).toHaveTextContent(byMsgId("profile-label-save-error"));
    expect(input()).toHaveValue("Work");
  });

  it("si el guardado va bien, no hay aviso", async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<LabelEditor label="Work" onSubmit={onSubmit} />);
    await userEvent.type(input(), "!{Enter}");
    await Promise.resolve();
    expect(saveError()).not.toBeInTheDocument();
    expect(input()).toHaveValue("Work!");
  });

  it("un onSubmit que no devuelve promesa sigue funcionando como antes", async () => {
    const onSubmit = jest.fn();
    render(<LabelEditor label="Work" onSubmit={onSubmit} />);
    await userEvent.type(input(), "!{Enter}");
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(saveError()).not.toBeInTheDocument();
  });

  it("el aviso desaparece al volver a escribir", async () => {
    const onSubmit = jest.fn().mockRejectedValue(new Error("offline"));
    render(<LabelEditor label="Work" onSubmit={onSubmit} />);
    await userEvent.type(input(), "!{Enter}");
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    await userEvent.type(input(), "x");
    expect(saveError()).not.toBeInTheDocument();
  });

  it("también avisa si falla quitar la etiqueta", async () => {
    const onSubmit = jest.fn().mockRejectedValue(new Error("offline"));
    render(<LabelEditor label="Work" onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("button", { name: byMsgId("profile-label-remove") }));
    expect(onSubmit).toHaveBeenCalledWith("");
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(input()).toHaveValue("Work");
  });

  it("la cadena está en pendingTranslations.ftl", () => {
    expect(ftl()).toMatch(/^profile-label-save-error = \S/m);
  });
});
