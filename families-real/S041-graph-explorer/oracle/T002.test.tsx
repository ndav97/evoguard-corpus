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
      aria-label="size"
      value={value}
      onValueChange={next => {
        setValue(next);
        onChange?.(next);
      }}
      {...props}
    />
  );
}

const field = () => screen.getByLabelText<HTMLInputElement>("size");
const type = (text: string) => fireEvent.change(field(), { target: { value: text } });
const escape = () => fireEvent.keyDown(field(), { key: "Escape" });

// T002 — Escape cancela la edición.
describe("T002 · Escape durante la edición", () => {
  it("vuelve al valor de antes de empezar a escribir y avisa", () => {
    const onChange = vi.fn();
    render(<Harness initialValue={12} onChange={onChange} />);
    type("1");
    type("13");
    type("135");
    expect(escape()).toBe(false);
    expect(onChange).toHaveBeenLastCalledWith(12);
    expect(field().value).toBe("12");
    fireEvent.blur(field());
    expect(onChange).toHaveBeenCalledTimes(4);
    expect(field().value).toBe("12");
  });

  it("también vuelve a un campo vacío", () => {
    const onChange = vi.fn();
    render(<Harness initialValue={undefined} onChange={onChange} />);
    type("4");
    escape();
    expect(onChange).toHaveBeenLastCalledWith(undefined);
    expect(field().value).toBe("");
  });

  it("una edición nueva parte del valor de ese momento", () => {
    const onChange = vi.fn();
    render(<Harness initialValue={1} onChange={onChange} />);
    type("2");
    fireEvent.blur(field());
    type("3");
    escape();
    expect(onChange).toHaveBeenLastCalledWith(2);
    expect(field().value).toBe("2");
  });

  it("fuera de una edición no hace nada", () => {
    const onChange = vi.fn();
    render(<Harness initialValue={5} onChange={onChange} />);
    expect(escape()).toBe(true);
    type("6");
    fireEvent.blur(field());
    expect(escape()).toBe(true);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(field().value).toBe("6");
  });

  it("llama antes al onKeyDown propio y respeta su preventDefault", () => {
    const onChange = vi.fn();
    const onKeyDown = vi.fn((e: React.KeyboardEvent) => e.preventDefault());
    render(<Harness initialValue={5} onChange={onChange} onKeyDown={onKeyDown} />);
    type("8");
    escape();
    expect(onKeyDown).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(field().value).toBe("8");
  });

  it("el onKeyDown propio recibe las teclas y no impide cancelar si no lo pide", () => {
    const onChange = vi.fn();
    const onKeyDown = vi.fn();
    render(<Harness initialValue={5} onChange={onChange} onKeyDown={onKeyDown} />);
    fireEvent.keyDown(field(), { key: "a" });
    type("8");
    escape();
    expect(onKeyDown).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith(5);
  });

  it("los límites del turno anterior se mantienen", () => {
    const onChange = vi.fn();
    render(<Harness initialValue={0.5} min={0} max={1} onChange={onChange} />);
    type("3");
    fireEvent.blur(field());
    expect(onChange).toHaveBeenLastCalledWith(1);
  });
});
