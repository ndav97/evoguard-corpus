// @vitest-environment jsdom
// EvoGuard S009 · T005 — ocultar cotizaciones sin datos (options.hideMissing).

import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "test-utils/render-with-providers";

const { useSWR } = vi.hoisted(() => ({ useSWR: vi.fn() }));
vi.mock("swr", () => ({ default: useSWR }));

import Stocks from "components/widgets/stocks/stocks";

const TICKERS = ["AAPL", "msft", "NVDA", "GOOG", "TSLA", "AMZN"];

const data = {
  stocks: [
    { ticker: "NASDAQ:NVDA", currentPrice: 10, percentChange: 0.5 },
    { ticker: "TSLA", currentPrice: 11, percentChange: null },
    { ticker: "AMZN" },
    { ticker: "NYSE:msft", currentPrice: 12, percentChange: 2.25 },
    null,
    { ticker: "AAPL", currentPrice: null, percentChange: null },
    { ticker: "GOOG", currentPrice: 14, percentChange: 0.5 },
  ],
};

const order = () =>
  screen
    .getAllByText((content) => TICKERS.includes(content))
    .map((el) => el.textContent);

const render = (options) => renderWithProviders(<Stocks options={options} />, { settings: {} });

describe("evoguard S009 T005 — stocks hideMissing option", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useSWR.mockReturnValue({ data, error: undefined });
  });

  it("by default quotes without data are still shown", () => {
    render({});
    expect(order()).toEqual(["NVDA", "TSLA", "AMZN", "msft", "AAPL", "GOOG"]);
  });

  it("hides quotes with neither price nor percent change", () => {
    render({ hideMissing: true });
    expect(order()).toEqual(["NVDA", "TSLA", "msft", "GOOG"]);
  });

  it("only the boolean true enables it", () => {
    render({ hideMissing: "yes" });
    expect(order()).toHaveLength(6);
  });

  it("keeps quotes that only miss one of the two values", () => {
    render({ hideMissing: true });
    expect(screen.getByText("TSLA")).toBeInTheDocument();
    expect(screen.getByText("11")).toBeInTheDocument();
  });

  it("works with sort and limit: hidden quotes do not count", () => {
    render({ hideMissing: true, sort: "ticker", limit: 3 });
    expect(order()).toEqual(["GOOG", "msft", "NVDA"]);
    expect(screen.getByText("+1")).toBeInTheDocument();
  });

  it("does not mutate the data returned by the API", () => {
    const before = JSON.stringify(data);
    render({ hideMissing: true, sort: "change" });
    expect(JSON.stringify(data)).toBe(before);
  });
});
