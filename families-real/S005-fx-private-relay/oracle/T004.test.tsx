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

// T004 — El campo muestra las etiquetas que cambian fuera del editor.
describe("T004 · sincronizar con la etiqueta recibida", () => {
  it("sin foco, el campo pasa a mostrar la nueva etiqueta", () => {
    const { rerender } = render(<LabelEditor label="Work" onSubmit={jest.fn()} />);
    expect(input()).toHaveValue("Work");
    rerender(<LabelEditor label="Home" onSubmit={jest.fn()} />);
    expect(input()).toHaveValue("Home");
    rerender(<LabelEditor label="" onSubmit={jest.fn()} />);
    expect(input()).toHaveValue("");
  });

  it("mientras se edita, no pisa lo que el usuario está escribiendo", async () => {
    const { rerender } = render(<LabelEditor label="Work" onSubmit={jest.fn()} />);
    await userEvent.type(input(), "!");
    rerender(<LabelEditor label="Home" onSubmit={jest.fn()} />);
    expect(input()).toHaveValue("Work!");
    expect(input()).toHaveFocus();
  });

  it("Escape restaura la etiqueta recibida más reciente sin guardar", async () => {
    const onSubmit = jest.fn();
    const { rerender } = render(<LabelEditor label="Work" onSubmit={onSubmit} />);
    await userEvent.type(input(), "!");
    rerender(<LabelEditor label="Home" onSubmit={onSubmit} />);
    await userEvent.keyboard("{Escape}");
    expect(input()).toHaveValue("Home");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("tras guardar muestra la etiqueta que devuelve el padre", async () => {
    const onSubmit = jest.fn();
    const { rerender } = render(<LabelEditor label="" onSubmit={onSubmit} />);
    await userEvent.type(input(), "  Shopping  {Enter}");
    expect(onSubmit).toHaveBeenCalledWith("Shopping");
    rerender(<LabelEditor label="Shopping" onSubmit={onSubmit} />);
    expect(input()).toHaveValue("Shopping");
  });

  it("el contador refleja la etiqueta recibida", () => {
    const { rerender } = render(<LabelEditor label="short" onSubmit={jest.fn()} />);
    expect(screen.queryByText(byMsgId("profile-label-characters-remaining"))).not.toBeInTheDocument();
    rerender(<LabelEditor label={"a".repeat(45)} onSubmit={jest.fn()} />);
    expect(screen.getByText(byMsgId("profile-label-characters-remaining"))).toHaveTextContent('"remaining":5');
  });
});
