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
      aria-label="border"
      value={value}
      onValueChange={next => {
        setValue(next);
        onChange?.(next);
      }}
      {...props}
    />
  );
}

const field = () => screen.getByLabelText<HTMLInputElement>("border");
const type = (text: string) => fireEvent.change(field(), { target: { value: text } });

// T004 — Valor para el campo vacío.
describe("T004 · emptyValue", () => {
  it("al salir con el campo vacío usa emptyValue", () => {
    const onChange = vi.fn();
    render(<Harness initialValue={3} emptyValue={1} onChange={onChange} />);
    type("");
    expect(onChange).toHaveBeenLastCalledWith(undefined);
    expect(field().value).toBe("");
    fireEvent.blur(field());
    expect(onChange).toHaveBeenLastCalledWith(1);
    expect(field().value).toBe("1");
  });

  it("también con un texto que no es un número", () => {
    const onChange = vi.fn();
    render(<Harness initialValue={3} emptyValue={0} onChange={onChange} />);
    type("-");
    fireEvent.blur(field());
    expect(onChange).toHaveBeenLastCalledWith(0);
    expect(field().value).toBe("0");
  });

  it("emptyValue no se redondea ni se ajusta a los límites", () => {
    const onChange = vi.fn();
    render(<Harness initialValue={3} emptyValue={0.75} precision={0} min={1} onChange={onChange} />);
    type("");
    fireEvent.blur(field());
    expect(onChange).toHaveBeenLastCalledWith(0.75);
  });

  it("sin editar no se usa", () => {
    const onChange = vi.fn();
    render(<Harness initialValue={undefined} emptyValue={2} onChange={onChange} />);
    fireEvent.blur(field());
    expect(onChange).not.toHaveBeenCalled();
    expect(field().value).toBe("");
  });

  it("sin emptyValue el vacío sigue siendo undefined, y no llega al input", () => {
    const onChange = vi.fn();
    render(<Harness initialValue={3} onChange={onChange} />);
    type("");
    fireEvent.blur(field());
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(field().value).toBe("");
    expect(field()).not.toHaveAttribute("emptyValue");
    expect(field()).not.toHaveAttribute("emptyvalue");
  });

  it("Escape con el campo vacío vuelve al valor anterior", () => {
    const onChange = vi.fn();
    render(<Harness initialValue={4} emptyValue={1} onChange={onChange} />);
    type("");
    fireEvent.keyDown(field(), { key: "Escape" });
    fireEvent.blur(field());
    expect(onChange).toHaveBeenLastCalledWith(4);
    expect(field().value).toBe("4");
  });

  it("los números siguen redondeándose y ajustándose", () => {
    const onChange = vi.fn();
    render(<Harness initialValue={1} emptyValue={1} precision={1} max={5} onChange={onChange} />);
    type("2.26");
    fireEvent.blur(field());
    expect(onChange).toHaveBeenLastCalledWith(2.3);
    type("9");
    fireEvent.blur(field());
    expect(onChange).toHaveBeenLastCalledWith(5);
  });
});
