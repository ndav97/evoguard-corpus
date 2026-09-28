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

// T002 — Escape cancela la edición.
describe("T002 · cancelar con Escape", () => {
  it("restaura la etiqueta, quita el foco y no guarda", async () => {
    const onSubmit = jest.fn();
    render(<LabelEditor label="Work" onSubmit={onSubmit} />);
    await userEvent.type(input(), " trip");
    expect(input()).toHaveValue("Work trip");
    await userEvent.keyboard("{Escape}");
    expect(input()).toHaveValue("Work");
    expect(input()).not.toHaveFocus();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("también restaura si se había borrado todo", async () => {
    const onSubmit = jest.fn();
    render(<LabelEditor label="Work" onSubmit={onSubmit} />);
    await userEvent.clear(input());
    await userEvent.keyboard("{Escape}");
    expect(input()).toHaveValue("Work");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("Enter sigue guardando el valor recortado", async () => {
    const onSubmit = jest.fn();
    render(<LabelEditor label="Work" onSubmit={onSubmit} />);
    await userEvent.type(input(), " trip  {Enter}");
    expect(onSubmit).toHaveBeenCalledWith("Work trip");
  });

  it("salir del campo sin Escape sigue guardando", async () => {
    const onSubmit = jest.fn();
    render(<LabelEditor label="Work" onSubmit={onSubmit} />);
    await userEvent.type(input(), "!");
    await userEvent.tab();
    expect(onSubmit).toHaveBeenCalledWith("Work!");
  });

  it("el contador refleja el valor restaurado", async () => {
    render(<LabelEditor label={"c".repeat(45)} onSubmit={jest.fn()} />);
    await userEvent.type(input(), "xyz");
    expect(
      screen.getByText(byMsgId("profile-label-characters-remaining"))
        .textContent,
    ).toContain('"remaining":2');
    await userEvent.keyboard("{Escape}");
    expect(
      screen.getByText(byMsgId("profile-label-characters-remaining"))
        .textContent,
    ).toContain('"remaining":5');
  });
});
