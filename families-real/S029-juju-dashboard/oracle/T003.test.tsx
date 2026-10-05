// Tests ocultos del estudio.
import { render, screen, within } from "@testing-library/react";

import ChipGroup from "../components/ChipGroup";

describe("T003 · grupo accesible", () => {
  it("con descriptor, el grupo se llama como el texto del descriptor", () => {
    render(
      <ChipGroup
        chips={{ running: 3, blocked: 2, alert: 1 }}
        descriptor="units"
      />,
    );
    const group = screen.getByRole("group", { name: "6 Units" });
    expect(within(group).getByText("3 running")).toBeInTheDocument();
    expect(within(group).getByText("1 alert")).toBeInTheDocument();
  });

  it("el nombre del grupo respeta el singular", () => {
    render(<ChipGroup chips={{ running: 1 }} descriptor="machines" />);
    expect(
      screen.getByRole("group", { name: "1 Machine" }),
    ).toBeInTheDocument();
  });

  it("sin descriptor, el grupo se llama «Status counts»", () => {
    render(<ChipGroup chips={{ running: 2, alert: 1 }} descriptor={null} />);
    const group = screen.getByRole("group", { name: "Status counts" });
    expect(within(group).getByText("2 running")).toBeInTheDocument();
  });

  it("sin chips no se muestra ningún grupo", () => {
    render(<ChipGroup chips={{ running: 0 }} descriptor="units" />);
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });
});
