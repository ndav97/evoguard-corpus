// Tests ocultos del estudio.
import React from "react";

import { act, fireEvent, render, screen } from "@testing-library/react";
import { SearchForm } from "~/components/search-form";

const input = () => screen.getByLabelText("Cari provinsi:");
const type = (value: string) => fireEvent.change(input(), { target: { value } });
const FILTER_ITEMS = { lokasi: { title: "Lokasi", buckets: [{ key: "Bandung", doc_count: 3 }] } };
const SORT_SETTINGS = [
  { value: "nama", label: "Nama" },
  { value: "terbaru", label: "Terbaru" },
];
const select = (container: HTMLElement, name: string) =>
  container.querySelector(`select[name="${name}"]`) as HTMLSelectElement;

afterEach(() => {
  jest.useRealTimers();
});

const clearButton = () => screen.queryByRole("button", { name: "Kosongkan kata kunci" });
const INITIAL = { filters: { lokasi: ["Bandung"] } };

// T004 — Escape borra la búsqueda.
describe("T004 · Escape en el campo de búsqueda", () => {
  it("con texto, Escape vacía el campo y busca sin palabras conservando los filtros", () => {
    const onSubmit = jest.fn();
    render(<SearchForm checkDocSize initialValue={INITIAL} itemName="provinsi" onSubmitKeywords={onSubmit} />);
    type("oksigen");
    fireEvent.keyDown(input(), { key: "Escape" });
    expect(input()).toHaveValue("");
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenLastCalledWith("", { lokasi: ["Bandung"] }, "");
    expect(clearButton()).not.toBeInTheDocument();
  });

  it("sin texto, Escape no hace nada", () => {
    const onSubmit = jest.fn();
    render(<SearchForm checkDocSize itemName="provinsi" onSubmitKeywords={onSubmit} />);
    fireEvent.keyDown(input(), { key: "Escape" });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("con búsqueda automática descarta la búsqueda pendiente", () => {
    jest.useFakeTimers();
    const onSubmit = jest.fn();
    render(<SearchForm autoSearch checkDocSize itemName="provinsi" onSubmitKeywords={onSubmit} />);
    type("oksigen");
    fireEvent.keyDown(input(), { key: "Escape" });
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenLastCalledWith("", {}, "");
  });

  it("conserva el orden elegido", () => {
    const onSubmit = jest.fn();
    const { container } = render(
      <SearchForm checkDocSize itemName="provinsi" onSubmitKeywords={onSubmit} sortSettings={SORT_SETTINGS} />,
    );
    fireEvent.change(select(container, "sort-by"), { target: { value: "terbaru" } });
    type("oksigen");
    fireEvent.keyDown(input(), { key: "Escape" });
    expect(onSubmit).toHaveBeenLastCalledWith("", {}, "terbaru");
  });

  it("otras teclas no borran", () => {
    const onSubmit = jest.fn();
    render(<SearchForm checkDocSize itemName="provinsi" onSubmitKeywords={onSubmit} />);
    type("oksigen");
    fireEvent.keyDown(input(), { key: "a" });
    expect(input()).toHaveValue("oksigen");
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
