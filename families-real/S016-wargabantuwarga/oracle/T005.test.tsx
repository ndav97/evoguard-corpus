// Tests ocultos del estudio.
import React from "react";

import { fireEvent, render, screen } from "@testing-library/react";
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

const resetButton = () => screen.queryByRole("button", { name: "Atur ulang filter" });

// T005 — Restablecer filtros y orden.
describe("T005 · restablecer filtros", () => {
  it("no aparece sin filtros ni orden distinto del inicial", () => {
    render(
      <SearchForm checkDocSize filterItems={FILTER_ITEMS} itemName="provinsi" onSubmitKeywords={jest.fn()} sortSettings={SORT_SETTINGS} />,
    );
    expect(resetButton()).not.toBeInTheDocument();
  });

  it("aparece al elegir un filtro y lo restablece conservando las palabras", () => {
    const onSubmit = jest.fn();
    const { container } = render(
      <SearchForm checkDocSize filterItems={FILTER_ITEMS} itemName="provinsi" onSubmitKeywords={onSubmit} sortSettings={SORT_SETTINGS} />,
    );
    type("  oksigen ");
    fireEvent.change(select(container, "lokasi"), { target: { value: "Bandung" } });
    expect(resetButton()).toBeInTheDocument();
    fireEvent.click(resetButton() as HTMLElement);
    expect(onSubmit).toHaveBeenLastCalledWith("oksigen", {}, "nama");
    expect(select(container, "lokasi")).toHaveValue("");
    expect(input()).toHaveValue("  oksigen ");
    expect(resetButton()).not.toBeInTheDocument();
  });

  it("aparece al cambiar el orden y vuelve al primero", () => {
    const onSubmit = jest.fn();
    const { container } = render(
      <SearchForm checkDocSize itemName="provinsi" onSubmitKeywords={onSubmit} sortSettings={SORT_SETTINGS} />,
    );
    fireEvent.change(select(container, "sort-by"), { target: { value: "terbaru" } });
    fireEvent.click(resetButton() as HTMLElement);
    expect(onSubmit).toHaveBeenLastCalledWith("", {}, "nama");
    expect(select(container, "sort-by")).toHaveValue("nama");
  });

  it("volver a «Semua» a mano también lo oculta", () => {
    const { container } = render(
      <SearchForm checkDocSize filterItems={FILTER_ITEMS} itemName="provinsi" onSubmitKeywords={jest.fn()} />,
    );
    fireEvent.change(select(container, "lokasi"), { target: { value: "Bandung" } });
    fireEvent.change(select(container, "lokasi"), { target: { value: "" } });
    expect(resetButton()).not.toBeInTheDocument();
  });

  it("aparece con filtros iniciales y no envía el formulario", () => {
    const onSubmit = jest.fn();
    render(
      <SearchForm checkDocSize filterItems={FILTER_ITEMS} initialValue={{ filters: { lokasi: ["Bandung"] } }} itemName="provinsi" onSubmitKeywords={onSubmit} />,
    );
    fireEvent.click(resetButton() as HTMLElement);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenLastCalledWith("", {}, "");
  });
});
