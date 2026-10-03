// Tests ocultos del estudio.
import React from "react";

import { act, fireEvent, render, screen } from "@testing-library/react";
import { SearchForm } from "~/components/search-form";

const input = () => screen.getByLabelText("Cari provinsi:");
const type = (value: string) => fireEvent.change(input(), { target: { value } });
const INITIAL = { filters: { lokasi: ["Bandung"] } };

afterEach(() => {
  jest.useRealTimers();
});

const clearButton = () => screen.queryByRole("button", { name: "Kosongkan kata kunci" });

// T002 — Botón para borrar la búsqueda.
describe("T002 · borrar la búsqueda", () => {
  it("solo aparece cuando hay texto", () => {
    render(<SearchForm checkDocSize itemName="provinsi" onSubmitKeywords={jest.fn()} />);
    expect(clearButton()).not.toBeInTheDocument();
    type("oksigen");
    expect(clearButton()).toBeInTheDocument();
  });

  it("vacía el campo y busca de inmediato sin palabras, conservando los filtros", () => {
    const onSubmit = jest.fn();
    render(<SearchForm checkDocSize initialValue={INITIAL} itemName="provinsi" onSubmitKeywords={onSubmit} />);
    type("oksigen");
    fireEvent.click(clearButton() as HTMLElement);
    expect(input()).toHaveValue("");
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenLastCalledWith("", { lokasi: ["Bandung"] }, "");
    expect(clearButton()).not.toBeInTheDocument();
  });

  it("no envía el formulario", () => {
    const onSubmit = jest.fn();
    render(<SearchForm checkDocSize initialValue={INITIAL} itemName="provinsi" onSubmitKeywords={onSubmit} />);
    type("oksigen");
    fireEvent.click(clearButton() as HTMLElement);
    expect(onSubmit).not.toHaveBeenCalledWith("", {}, "");
  });

  it("el envío sigue recortando las palabras", () => {
    const onSubmit = jest.fn();
    render(<SearchForm checkDocSize itemName="provinsi" onSubmitKeywords={onSubmit} />);
    type(" rs ");
    fireEvent.click(screen.getByText("Cari"));
    expect(onSubmit).toHaveBeenLastCalledWith("rs", {}, "");
  });
});
