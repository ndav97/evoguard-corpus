// Tests ocultos del estudio.
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ChipGroup from "../components/ChipGroup";

describe("T004 · chips pulsables", () => {
  it("con onChipClick cada chip es un botón que avisa con su etiqueta", async () => {
    const onChipClick = vi.fn();
    render(
      <ChipGroup
        chips={{ running: 1, blocked: 2 }}
        descriptor="units"
        onChipClick={onChipClick}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "2 blocked" }));
    expect(onChipClick).toHaveBeenCalledTimes(1);
    expect(onChipClick).toHaveBeenCalledWith("blocked");
    await userEvent.click(screen.getByRole("button", { name: "1 running" }));
    expect(onChipClick).toHaveBeenLastCalledWith("running");
  });

  it("solo hay botones para los chips con recuento mayor que 0", () => {
    render(
      <ChipGroup
        chips={{ running: 1, blocked: 2, alert: 0 }}
        descriptor={null}
        onChipClick={vi.fn()}
      />,
    );
    const group = screen.getByRole("group", { name: "Status counts" });
    expect(within(group).getAllByRole("button")).toHaveLength(2);
    expect(
      screen.queryByRole("button", { name: "0 alert" }),
    ).not.toBeInTheDocument();
  });

  it("los botones siguen el orden por recuento", () => {
    render(
      <ChipGroup
        chips={{ running: 1, blocked: 4, alert: 2 }}
        descriptor="units"
        onChipClick={vi.fn()}
      />,
    );
    expect(
      screen.getAllByRole("button").map((button) => button.textContent),
    ).toEqual(["4 blocked", "2 alert", "1 running"]);
  });

  it("sin onChipClick los chips no son botones", () => {
    render(<ChipGroup chips={{ running: 1, blocked: 2 }} descriptor="units" />);
    expect(screen.getByText("2 blocked")).toBeInTheDocument();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});
