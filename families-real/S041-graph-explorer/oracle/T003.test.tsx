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
      aria-label="thickness"
      value={value}
      onValueChange={next => {
        setValue(next);
        onChange?.(next);
      }}
      {...props}
    />
  );
}

const field = () => screen.getByLabelText<HTMLInputElement>("thickness");
const type = (text: string) => fireEvent.change(field(), { target: { value: text } });

// T003 — Redondeo al terminar la edición.
describe("T003 · precision", () => {
  it("redondea al salir y avisa del valor redondeado", () => {
    const onChange = vi.fn();
    render(<Harness initialValue={1} precision={2} onChange={onChange} />);
    type("1.23456");
    expect(onChange).toHaveBeenLastCalledWith(1.23456);
    expect(field().value).toBe("1.23456");
    fireEvent.blur(field());
    expect(onChange).toHaveBeenLastCalledWith(1.23);
    expect(field().value).toBe("1.23");
  });

  it("redondea las mitades hacia arriba", () => {
    const onChange = vi.fn();
    render(<Harness initialValue={1} precision={0} onChange={onChange} />);
    type("2.5");
    fireEvent.blur(field());
    expect(onChange).toHaveBeenLastCalledWith(3);
    type("7.25");
    fireEvent.blur(field());
    expect(onChange).toHaveBeenLastCalledWith(7);
  });

  it("no avisa de más si ya tenía esos decimales", () => {
    const onChange = vi.fn();
    render(<Harness initialValue={1} precision={1} onChange={onChange} />);
    type("4.5");
    fireEvent.blur(field());
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("redondea antes de aplicar los límites", () => {
    const onChange = vi.fn();
    render(<Harness initialValue={1} precision={0} max={2.5} onChange={onChange} />);
    type("2.4");
    fireEvent.blur(field());
    expect(onChange).toHaveBeenLastCalledWith(2);
    type("2.7");
    fireEvent.blur(field());
    expect(onChange).toHaveBeenLastCalledWith(2.5);
    expect(field().value).toBe("2.5");
  });

  it("una precisión que no es un entero válido no redondea", () => {
    const onChange = vi.fn();
    render(<Harness initialValue={1} precision={1.5} onChange={onChange} />);
    type("3.14159");
    fireEvent.blur(field());
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(field().value).toBe("3.14159");
  });

  it("sin precision no redondea, y precision no llega al input", () => {
    const onChange = vi.fn();
    render(<Harness initialValue={1} onChange={onChange} />);
    type("0.123");
    fireEvent.blur(field());
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(field()).not.toHaveAttribute("precision");
  });

  it("Escape sigue cancelando", () => {
    const onChange = vi.fn();
    render(<Harness initialValue={6} precision={0} onChange={onChange} />);
    type("6.6");
    fireEvent.keyDown(field(), { key: "Escape" });
    fireEvent.blur(field());
    expect(onChange).toHaveBeenLastCalledWith(6);
    expect(field().value).toBe("6");
  });
});
