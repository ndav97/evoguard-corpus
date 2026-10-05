// Tests ocultos del estudio.
import { render, screen } from "@testing-library/react";

import ChipGroup from "../components/ChipGroup";

describe("T001 · descriptor en singular", () => {
  it("usa «Unit» cuando el total es 1", () => {
    render(<ChipGroup chips={{ running: 1, blocked: 0 }} descriptor="units" />);
    expect(screen.getByText("1 Unit")).toBeInTheDocument();
    expect(screen.queryByText("1 Units")).not.toBeInTheDocument();
  });

  it("usa «Machine» cuando el total es 1", () => {
    render(<ChipGroup chips={{ alert: 1 }} descriptor="machines" />);
    expect(screen.getByText("1 Machine")).toBeInTheDocument();
  });

  it("usa «Local application» cuando el total es 1", () => {
    render(<ChipGroup chips={{ blocked: 1 }} descriptor="localApps" />);
    expect(screen.getByText("1 Local application")).toBeInTheDocument();
  });

  it("mantiene el plural cuando el total es distinto de 1", () => {
    render(
      <ChipGroup chips={{ running: 1, blocked: 1 }} descriptor="machines" />,
    );
    expect(screen.getByText("2 Machines")).toBeInTheDocument();
  });
});
