// Tests ocultos del estudio.
import { render, screen } from "@testing-library/react";

import ChipGroup from "../components/ChipGroup";

const CHIPS = { waiting: 2, alert: 3, running: 5, blocked: 4 };

describe("T005 · límite de chips visibles", () => {
  it("muestra solo los maxChips chips con más elementos y un chip «+N more»", () => {
    render(<ChipGroup chips={CHIPS} descriptor={null} maxChips={2} />);
    expect(screen.getByText("5 running")).toBeInTheDocument();
    expect(screen.getByText("4 blocked")).toBeInTheDocument();
    expect(screen.queryByText("3 alert")).not.toBeInTheDocument();
    expect(screen.queryByText("2 waiting")).not.toBeInTheDocument();
    expect(screen.getByText("+2 more")).toBeInTheDocument();
  });

  it("el descriptor sigue sumando todos los chips", () => {
    render(<ChipGroup chips={CHIPS} descriptor="units" maxChips={1} />);
    expect(screen.getByText("14 Units")).toBeInTheDocument();
    expect(screen.getByText("+3 more")).toBeInTheDocument();
  });

  it("si no se supera el límite no aparece el chip de resumen", () => {
    render(<ChipGroup chips={CHIPS} descriptor="units" maxChips={4} />);
    expect(screen.getByText("2 waiting")).toBeInTheDocument();
    expect(screen.queryByText(/more$/)).not.toBeInTheDocument();
  });

  it("los chips con recuento 0 no cuentan para el límite", () => {
    render(
      <ChipGroup
        chips={{ running: 5, waiting: 0, alert: 3 }}
        descriptor="units"
        maxChips={2}
      />,
    );
    expect(screen.getByText("3 alert")).toBeInTheDocument();
    expect(screen.queryByText(/more$/)).not.toBeInTheDocument();
  });

  it("el chip de resumen no es un botón", () => {
    render(
      <ChipGroup
        chips={CHIPS}
        descriptor="units"
        maxChips={2}
        onChipClick={vi.fn()}
      />,
    );
    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(screen.getByText("+2 more")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "+2 more" }),
    ).not.toBeInTheDocument();
  });
});
