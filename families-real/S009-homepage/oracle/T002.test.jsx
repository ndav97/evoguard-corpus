// @vitest-environment jsdom
// EvoGuard S009 · T002 — orden configurable de las cotizaciones (options.sort).

import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "test-utils/render-with-providers";

const { useSWR } = vi.hoisted(() => ({ useSWR: vi.fn() }));
vi.mock("swr", () => ({ default: useSWR }));

import Stocks from "components/widgets/stocks/stocks";

const TICKERS = ["AAPL", "msft", "NVDA", "GOOG", "TSLA"];

const data = {
  stocks: [
    { ticker: "NASDAQ:NVDA", currentPrice: 10, percentChange: 0.5 },
    { ticker: "TSLA", currentPrice: 11, percentChange: null },
    { ticker: "NYSE:msft", currentPrice: 12, percentChange: 2.25 },
    null,
    { ticker: "AAPL", currentPrice: 13, percentChange: -1.5 },
    { ticker: "GOOG", currentPrice: 14, percentChange: 0.5 },
  ],
};

const order = () =>
  screen
    .getAllByText((content) => TICKERS.includes(content))
    .map((el) => el.textContent);

describe("evoguard S009 T002 — stocks sort option", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useSWR.mockReturnValue({ data, error: undefined });
  });

  it("keeps the API order when no sort option is given", () => {
    renderWithProviders(<Stocks options={{}} />, { settings: {} });
    expect(order()).toEqual(["NVDA", "TSLA", "msft", "AAPL", "GOOG"]);
  });

  it("keeps the API order for unknown sort values", () => {
    renderWithProviders(<Stocks options={{ sort: "price" }} />, { settings: {} });
    expect(order()).toEqual(["NVDA", "TSLA", "msft", "AAPL", "GOOG"]);
  });

  it("sorts alphabetically by the displayed symbol, ignoring case and exchange prefix", () => {
    renderWithProviders(<Stocks options={{ sort: "ticker" }} />, { settings: {} });
    expect(order()).toEqual(["AAPL", "GOOG", "msft", "NVDA", "TSLA"]);
  });

  it("sorts by percent change descending, ties stable and missing changes last", () => {
    renderWithProviders(<Stocks options={{ sort: "change" }} />, { settings: {} });
    expect(order()).toEqual(["msft", "NVDA", "GOOG", "AAPL", "TSLA"]);
  });

  it("does not mutate the data returned by the API", () => {
    renderWithProviders(<Stocks options={{ sort: "ticker" }} />, { settings: {} });
    expect(data.stocks.map((s) => s && s.ticker)).toEqual([
      "NASDAQ:NVDA",
      "TSLA",
      "NYSE:msft",
      null,
      "AAPL",
      "GOOG",
    ]);
  });
});
