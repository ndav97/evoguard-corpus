// @vitest-environment happy-dom
// Tests ocultos del estudio.
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { NumberInput, type NumberInputProps } from "../components/NumberInput";

type HarnessProps = {
  initialValue: number | undefined;
  onChange?: (value: number | undefined) => void;
} & Omit<NumberInputProps, "value" | "onValueChange">;

function Harness({ initialValue, onChange, ...props }: HarnessProps) {
  const [value, setValue] = useState(initialValue);
  return (
    <NumberInput
      aria-label="opacity"
      value={value}
      onValueChange={next => {
        setValue(next);
        onChange?.(next);
      }}
      {...props}
    />
  );
}

const field = () => screen.getByLabelText<HTMLInputElement>("opacity");
const type = (text: string) => fireEvent.change(field(), { target: { value: text } });

// T001 — Límites al terminar la edición.
describe("T001 · min y max al salir del campo", () => {
  it("lleva al máximo un número mayor y avisa del valor corregido", () => {
    const onChange = vi.fn();
    render(<Harness initialValue={0.5} min={0} max={1} onChange={onChange} />);
    type("5");
    expect(onChange).toHaveBeenLastCalledWith(5);
    fireEvent.blur(field());
    expect(onChange).toHaveBeenLastCalledWith(1);
    expect(field().value).toBe("1");
  });

  it("lleva al mínimo un número menor", () => {
    const onChange = vi.fn();
    render(<Harness initialValue={2} min={1} onChange={onChange} />);
    type("-3");
    fireEvent.blur(field());
    expect(onChange).toHaveBeenLastCalledWith(1);
    expect(field().value).toBe("1");
  });

  it("no corrige mientras se escribe", () => {
    const onChange = vi.fn();
    render(<Harness initialValue={0.5} min={0.1} max={1} onChange={onChange} />);
    type("0");
    expect(onChange).toHaveBeenLastCalledWith(0);
    expect(field().value).toBe("0");
    type("0.");
    type("0.3");
    fireEvent.blur(field());
    expect(onChange).toHaveBeenLastCalledWith(0.3);
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it("acepta límites escritos como texto numérico", () => {
    const onChange = vi.fn();
    render(<Harness initialValue={1} min="2" max="4" onChange={onChange} />);
    type("9");
    fireEvent.blur(field());
    expect(onChange).toHaveBeenLastCalledWith(4);
  });

  it("un límite que no es un número no limita", () => {
    const onChange = vi.fn();
    render(<Harness initialValue={1} min="abc" onChange={onChange} />);
    type("-8");
    fireEvent.blur(field());
    expect(onChange).toHaveBeenLastCalledWith(-8);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("dentro del rango, vacío o sin editar no avisa al salir", () => {
    const onChange = vi.fn();
    render(<Harness initialValue={7} min={0} max={1} onChange={onChange} />);
    fireEvent.blur(field());
    expect(onChange).not.toHaveBeenCalled();
    expect(field().value).toBe("7");
    type("");
    fireEvent.blur(field());
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(undefined);
    type("0.4");
    fireEvent.blur(field());
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("los límites siguen llegando al input", () => {
    render(<Harness initialValue={1} min={0} max={3} />);
    expect(field()).toHaveAttribute("min", "0");
    expect(field()).toHaveAttribute("max", "3");
  });
});
