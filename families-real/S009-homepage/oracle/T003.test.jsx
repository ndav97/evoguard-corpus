// @vitest-environment jsdom
// EvoGuard S009 · T003 — recordar la vista (precio / % de cambio) por watchlist.

import { fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "test-utils/render-with-providers";

const { useSWR } = vi.hoisted(() => ({ useSWR: vi.fn() }));
vi.mock("swr", () => ({ default: useSWR }));

import Stocks from "components/widgets/stocks/stocks";

const data = {
  stocks: [{ ticker: "NASDAQ:AAPL", currentPrice: 123.45, percentChange: 1.23 }],
};

describe("evoguard S009 T003 — remembered view per watchlist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    localStorage.clear();
    useSWR.mockReturnValue({ data, error: undefined });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("stores the chosen view under a key derived from the watchlist", () => {
    renderWithProviders(<Stocks options={{ watchlist: "AAPL,MSFT" }} />, { settings: {} });

    fireEvent.click(screen.getByRole("button"));
    expect(localStorage.getItem("homepage-stocks-view:AAPL,MSFT")).toBe("percent");

    fireEvent.click(screen.getByRole("button"));
    expect(localStorage.getItem("homepage-stocks-view:AAPL,MSFT")).toBe("price");
  });

  it("restores the percent view for the same watchlist", () => {
    localStorage.setItem("homepage-stocks-view:AAPL,MSFT", "percent");

    renderWithProviders(<Stocks options={{ watchlist: "AAPL,MSFT" }} />, { settings: {} });

    expect(screen.getByText("1.23%")).toBeInTheDocument();
    expect(screen.queryByText("123.45")).not.toBeInTheDocument();
  });

  it("does not share the view between different watchlists", () => {
    localStorage.setItem("homepage-stocks-view:AAPL,MSFT", "percent");

    renderWithProviders(<Stocks options={{ watchlist: "AAPL" }} />, { settings: {} });

    expect(screen.getByText("123.45")).toBeInTheDocument();
  });

  it("shows prices for unknown stored values", () => {
    localStorage.setItem("homepage-stocks-view:AAPL", "sideways");

    renderWithProviders(<Stocks options={{ watchlist: "AAPL" }} />, { settings: {} });

    expect(screen.getByText("123.45")).toBeInTheDocument();
  });

  it("stores nothing when the widget has no watchlist", () => {
    renderWithProviders(<Stocks options={{}} />, { settings: {} });

    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByText("1.23%")).toBeInTheDocument();
    expect(localStorage.length).toBe(0);
  });

  it("keeps working when storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });

    renderWithProviders(<Stocks options={{ watchlist: "AAPL" }} />, { settings: {} });
    expect(screen.getByText("123.45")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("1.23%")).toBeInTheDocument();
  });
});
