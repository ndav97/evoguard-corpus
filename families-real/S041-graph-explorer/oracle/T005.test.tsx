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
const up = (shiftKey = false) => fireEvent.keyDown(field(), { key: "ArrowUp", shiftKey });
const down = (shiftKey = false) => fireEvent.keyDown(field(), { key: "ArrowDown", shiftKey });

// T005 — Flechas del teclado.
describe("T005 · ArrowUp y ArrowDown", () => {
  it("suben y bajan un step sin errores de coma flotante", () => {
    const onChange = vi.fn();
    render(<Harness initialValue={0.2} step={0.1} onChange={onChange} />);
    expect(up()).toBe(false);
    expect(onChange).toHaveBeenLastCalledWith(0.3);
    expect(field().value).toBe("0.3");
    expect(down()).toBe(false);
    down();
    expect(onChange).toHaveBeenLastCalledWith(0.1);
    expect(field().value).toBe("0.1");
  });

  it("con Shift el salto es de diez pasos", () => {
    const onChange = vi.fn();
    render(<Harness initialValue={1} step={0.5} onChange={onChange} />);
    up(true);
    expect(onChange).toHaveBeenLastCalledWith(6);
    down(true);
    down(true);
    expect(onChange).toHaveBeenLastCalledWith(-4);
  });

  it("sin step válido el paso es 1, y step puede ser texto", () => {
    const onChange = vi.fn();
    const { unmount } = render(<Harness initialValue={3} step="any" onChange={onChange} />);
    up();
    expect(onChange).toHaveBeenLastCalledWith(4);
    unmount();
    render(<Harness initialValue={3} step="0.25" onChange={onChange} />);
    up();
    expect(onChange).toHaveBeenLastCalledWith(3.25);
  });

  it("parte de lo que se está escribiendo, o de 0 si está vacío", () => {
    const onChange = vi.fn();
    render(<Harness initialValue={10} onChange={onChange} />);
    type("4.5");
    up();
    expect(onChange).toHaveBeenLastCalledWith(5.5);
    expect(field().value).toBe("5.5");
    type("");
    down();
    expect(onChange).toHaveBeenLastCalledWith(-1);
  });

  it("respeta precision, min y max", () => {
    const onChange = vi.fn();
    render(<Harness initialValue={0.95} step={0.1} min={0} max={1} onChange={onChange} />);
    up();
    expect(onChange).toHaveBeenLastCalledWith(1);
    down(true);
    down(true);
    expect(onChange).toHaveBeenLastCalledWith(0);
    expect(field().value).toBe("0");
  });

  it("con precision redondea a esos decimales", () => {
    const onChange = vi.fn();
    render(<Harness initialValue={1.04} step={0.5} precision={1} onChange={onChange} />);
    up();
    expect(onChange).toHaveBeenLastCalledWith(1.5);
  });

  it("cuenta como edición: Escape vuelve y salir no avisa más", () => {
    const onChange = vi.fn();
    render(<Harness initialValue={2} onChange={onChange} />);
    up();
    up();
    fireEvent.keyDown(field(), { key: "Escape" });
    expect(onChange).toHaveBeenLastCalledWith(2);
    expect(field().value).toBe("2");
    up();
    fireEvent.blur(field());
    expect(onChange).toHaveBeenCalledTimes(4);
    expect(field().value).toBe("3");
  });

  it("el onKeyDown propio con preventDefault lo desactiva", () => {
    const onChange = vi.fn();
    const onKeyDown = vi.fn((e: React.KeyboardEvent) => e.preventDefault());
    render(<Harness initialValue={2} onChange={onChange} onKeyDown={onKeyDown} />);
    up();
    expect(onKeyDown).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("otras teclas no hacen nada", () => {
    const onChange = vi.fn();
    render(<Harness initialValue={2} onChange={onChange} />);
    expect(fireEvent.keyDown(field(), { key: "ArrowLeft" })).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
  });
});
