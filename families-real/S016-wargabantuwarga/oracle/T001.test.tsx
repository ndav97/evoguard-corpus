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

// T001 — Palabras clave sin espacios sobrantes.
describe("T001 · búsqueda recortada", () => {
  it("al enviar el formulario se buscan las palabras sin espacios al inicio ni al final", () => {
    const onSubmit = jest.fn();
    render(<SearchForm checkDocSize itemName="provinsi" onSubmitKeywords={onSubmit} />);
    type("  oksigen  ");
    fireEvent.click(screen.getByText("Cari"));
    expect(onSubmit).toHaveBeenLastCalledWith("oksigen", {}, "");
  });

  it("la búsqueda automática también recorta", () => {
    jest.useFakeTimers();
    const onSubmit = jest.fn();
    render(<SearchForm autoSearch checkDocSize itemName="provinsi" onSubmitKeywords={onSubmit} />);
    type("  Jawa  ");
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(onSubmit).toHaveBeenLastCalledWith("Jawa", {}, "");
  });

  it("el campo conserva lo que escribió el usuario", () => {
    render(<SearchForm checkDocSize itemName="provinsi" onSubmitKeywords={jest.fn()} />);
    type("  oksigen  ");
    expect(input()).toHaveValue("  oksigen  ");
  });
});
