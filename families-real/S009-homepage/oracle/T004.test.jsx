// @vitest-environment jsdom
// EvoGuard S009 · T004 — límite de cotizaciones mostradas (options.limit).

import { fireEvent, screen } from "@testing-library/react";
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

const render = (options) => renderWithProviders(<Stocks options={options} />, { settings: {} });

describe("evoguard S009 T004 — stocks limit option", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useSWR.mockReturnValue({ data, error: undefined });
  });

  it("without limit shows every quote and no counter", () => {
    render({});
    expect(order()).toEqual(["NVDA", "TSLA", "msft", "AAPL", "GOOG"]);
    expect(screen.queryByText(/^\+\d+$/)).not.toBeInTheDocument();
  });

  it("shows only the first N quotes and how many are hidden", () => {
    render({ limit: 2 });
    expect(order()).toEqual(["NVDA", "TSLA"]);
    expect(screen.getByText("+3")).toBeInTheDocument();
  });

  it("applies the limit after sorting", () => {
    render({ limit: 3, sort: "change" });
    expect(order()).toEqual(["msft", "NVDA", "GOOG"]);
    expect(screen.getByText("+2")).toBeInTheDocument();
  });

  it("null entries do not count towards the limit", () => {
    render({ limit: 4 });
    expect(order()).toEqual(["NVDA", "TSLA", "msft", "AAPL"]);
    expect(screen.getByText("+1")).toBeInTheDocument();
  });

  it("a limit equal to or larger than the list shows everything without counter", () => {
    render({ limit: 5 });
    expect(order()).toHaveLength(5);
    expect(screen.queryByText(/^\+\d+$/)).not.toBeInTheDocument();
  });

  it("ignores limits that are not positive integers", () => {
    for (const limit of [0, -1, 2.5, "abc"]) {
      const { unmount } = render({ limit });
      expect(order()).toHaveLength(5);
      unmount();
    }
  });

  it("keeps the accessible toggle working with a limit", () => {
    render({ limit: 1 });
    const button = screen.getByRole("button", { name: "stocks.show_percent_change" });
    fireEvent.click(button);
    expect(screen.getByRole("button", { name: "stocks.show_price" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("0.5%")).toBeInTheDocument();
    expect(screen.getByText("+4")).toBeInTheDocument();
  });
});
