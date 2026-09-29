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

const removeButton = () =>
  screen.queryByRole("button", { name: byMsgId("profile-label-remove") });

// T003 — Botón para quitar la etiqueta.
describe("T003 · quitar la etiqueta", () => {
  it("solo aparece si la máscara tiene etiqueta", () => {
    const { rerender } = render(
      <LabelEditor label="Work" onSubmit={jest.fn()} />,
    );
    expect(removeButton()).toBeInTheDocument();
    expect(removeButton()).toHaveAttribute("type", "button");
    rerender(<LabelEditor label="" onSubmit={jest.fn()} />);
    expect(removeButton()).not.toBeInTheDocument();
  });

  it("guarda una etiqueta vacía y vacía el campo", async () => {
    const onSubmit = jest.fn();
    render(<LabelEditor label="Work" onSubmit={onSubmit} />);
    await userEvent.click(removeButton()!);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith("");
    expect(input()).toHaveValue("");
  });

  it("no guarda dos veces si el campo tenía el foco", async () => {
    const onSubmit = jest.fn();
    render(<LabelEditor label="Work" onSubmit={onSubmit} />);
    await userEvent.click(input());
    await userEvent.click(removeButton()!);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith("");
  });

  it("la cadena está en pendingTranslations.ftl", () => {
    expect(ftl()).toMatch(/^profile-label-remove = \S/m);
  });
});
