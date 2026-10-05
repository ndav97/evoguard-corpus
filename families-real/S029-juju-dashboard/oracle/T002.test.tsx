// Tests ocultos del estudio.
import { render, screen } from "@testing-library/react";

import ChipGroup from "../components/ChipGroup";

const chipTexts = (): (null | string)[] =>
  screen
    .getAllByText(/^\d+ (running|blocked|alert)$/)
    .map((chip) => chip.textContent);

describe("T002 · chips ordenados por recuento", () => {
  it("muestra primero los chips con más elementos", () => {
    render(
      <ChipGroup
        chips={{ running: 1, blocked: 3, alert: 2 }}
        descriptor="units"
      />,
    );
    expect(chipTexts()).toEqual(["3 blocked", "2 alert", "1 running"]);
  });

  it("los empates conservan el orden original", () => {
    render(
      <ChipGroup
        chips={{ running: 2, blocked: 5, alert: 2 }}
        descriptor={null}
      />,
    );
    expect(chipTexts()).toEqual(["5 blocked", "2 running", "2 alert"]);
  });

  it("los chips con recuento 0 siguen sin mostrarse", () => {
    render(
      <ChipGroup
        chips={{ running: 0, blocked: 1, alert: 4 }}
        descriptor="units"
      />,
    );
    expect(chipTexts()).toEqual(["4 alert", "1 blocked"]);
    expect(screen.queryByText("0 running")).not.toBeInTheDocument();
  });
});
