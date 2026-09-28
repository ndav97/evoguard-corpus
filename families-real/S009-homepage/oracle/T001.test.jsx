// @vitest-environment jsdom
// EvoGuard S009 · T001 — botón de alternancia accesible en el widget de cotizaciones.

import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "test-utils/render-with-providers";

import common from "../../public/locales/en/common.json";

const { useSWR } = vi.hoisted(() => ({ useSWR: vi.fn() }));
vi.mock("swr", () => ({ default: useSWR }));

import Stocks from "components/widgets/stocks/stocks";

const data = {
  stocks: [
    { ticker: "NASDAQ:AAPL", currentPrice: 123.45, percentChange: 1.23 },
    { ticker: "MSFT", currentPrice: 99.99, percentChange: -0.5 },
  ],
};

describe("evoguard S009 T001 — stocks toggle accessibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useSWR.mockReturnValue({ data, error: undefined });
  });

  it("labels the toggle with the action it performs and starts unpressed", () => {
    renderWithProviders(<Stocks options={{ color: false }} />, { settings: {} });

    const button = screen.getByRole("button", { name: "stocks.show_percent_change" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("123.45")).toBeInTheDocument();
  });

  it("switches label and pressed state after clicking", () => {
    renderWithProviders(<Stocks options={{ color: false }} />, { settings: {} });

    fireEvent.click(screen.getByRole("button", { name: "stocks.show_percent_change" }));

    const button = screen.getByRole("button", { name: "stocks.show_price" });
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("1.23%")).toBeInTheDocument();
  });

  it("goes back to prices on a second click", () => {
    renderWithProviders(<Stocks options={{ color: false }} />, { settings: {} });

    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByRole("button"));

    const button = screen.getByRole("button", { name: "stocks.show_percent_change" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("99.99")).toBeInTheDocument();
  });

  it("adds the English strings to the locale file", () => {
    expect(common.stocks.show_percent_change).toBe("Show percent change");
    expect(common.stocks.show_price).toBe("Show price");
  });
});
