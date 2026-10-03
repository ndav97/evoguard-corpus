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

const wait = () =>
  act(() => {
    jest.advanceTimersByTime(300);
  });

// T003 — La búsqueda automática espera a tener dos caracteres.
describe("T003 · mínimo de dos caracteres en la búsqueda automática", () => {
  it("no busca con un solo carácter", () => {
    jest.useFakeTimers();
    const onSubmit = jest.fn();
    render(<SearchForm autoSearch checkDocSize itemName="provinsi" onSubmitKeywords={onSubmit} />);
    type("a");
    wait();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("los espacios no cuentan como caracteres", () => {
    jest.useFakeTimers();
    const onSubmit = jest.fn();
    render(<SearchForm autoSearch checkDocSize itemName="provinsi" onSubmitKeywords={onSubmit} />);
    type(" a ");
    wait();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("busca a partir de dos caracteres", () => {
    jest.useFakeTimers();
    const onSubmit = jest.fn();
    render(<SearchForm autoSearch checkDocSize itemName="provinsi" onSubmitKeywords={onSubmit} />);
    type("ab");
    wait();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenLastCalledWith("ab", {}, "");
  });

  it("al vaciar el campo vuelve a buscar sin palabras", () => {
    jest.useFakeTimers();
    const onSubmit = jest.fn();
    render(<SearchForm autoSearch checkDocSize itemName="provinsi" onSubmitKeywords={onSubmit} />);
    type("ab");
    wait();
    type("");
    wait();
    expect(onSubmit).toHaveBeenLastCalledWith("", {}, "");
  });

  it("el envío manual no tiene mínimo", () => {
    const onSubmit = jest.fn();
    render(<SearchForm checkDocSize itemName="provinsi" onSubmitKeywords={onSubmit} />);
    type("a");
    fireEvent.click(screen.getByText("Cari"));
    expect(onSubmit).toHaveBeenLastCalledWith("a", {}, "");
  });

  it("el botón de borrar sigue funcionando en modo automático", () => {
    jest.useFakeTimers();
    const onSubmit = jest.fn();
    render(<SearchForm autoSearch checkDocSize itemName="provinsi" onSubmitKeywords={onSubmit} />);
    type("ab");
    fireEvent.click(screen.getByRole("button", { name: "Kosongkan kata kunci" }));
    expect(input()).toHaveValue("");
    expect(onSubmit).toHaveBeenLastCalledWith("", {}, "");
  });
});
