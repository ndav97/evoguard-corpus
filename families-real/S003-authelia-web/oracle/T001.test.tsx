// SPDX-FileCopyrightText: 2026 Authelia
//
// SPDX-License-Identifier: Apache-2.0

import { render, screen, waitFor } from "@testing-library/react";
import zxcvbn from "zxcvbn";

import PasswordMeter from "@components/PasswordMeter";
import "@i18n/index";
import { PasswordPolicyConfiguration, PasswordPolicyMode } from "@models/PasswordPolicy";

vi.mock("zxcvbn", () => ({ default: vi.fn(() => ({ feedback: { suggestions: [], warning: "" }, score: 0 })) }));

const zxcvbnScore = (score: number) =>
    vi.mocked(zxcvbn).mockReturnValue({ feedback: { suggestions: [], warning: "" }, score } as any);

const policy = (over: Partial<PasswordPolicyConfiguration> = {}): PasswordPolicyConfiguration => ({
    max_length: 0,
    min_length: 0,
    min_score: 0,
    mode: PasswordPolicyMode.Standard,
    require_lowercase: false,
    require_number: false,
    require_special: false,
    require_uppercase: false,
    ...over,
});

// T001 — Indicador de fortaleza accesible y nivel en texto.
describe("T001 · indicador de fortaleza", () => {
    const bar = () => screen.getByRole("progressbar", { name: "Password strength" });

    it("expone el nivel en la barra y en texto (modo estándar, cumple todo)", () => {
        render(<PasswordMeter value={"abcdefgh1"} policy={policy({ min_length: 8, require_lowercase: true, require_number: true })} />);
        expect(bar()).toHaveAttribute("aria-valuemin", "0");
        expect(bar()).toHaveAttribute("aria-valuemax", "3");
        expect(bar()).toHaveAttribute("aria-valuenow", "3");
        expect(screen.getByText("Strength: Strong")).toBeInTheDocument();
    });

    it("demasiado corta: nivel 0", () => {
        render(<PasswordMeter value={"abc"} policy={policy({ min_length: 8 })} />);
        expect(bar()).toHaveAttribute("aria-valuenow", "0");
        expect(screen.getByText("Strength: Very weak")).toBeInTheDocument();
    });

    it("niveles intermedios en modo estándar", () => {
        const p = policy({ require_lowercase: true, require_uppercase: true });
        const { rerender } = render(<PasswordMeter value={"abcdefgh"} policy={p} />);
        expect(screen.getByText("Strength: Fair")).toBeInTheDocument();
        rerender(<PasswordMeter value={"12345678"} policy={p} />);
        expect(screen.getByText("Strength: Weak")).toBeInTheDocument();
        expect(bar()).toHaveAttribute("aria-valuenow", "1");
    });

    it("modo ZXCVBN usa cinco niveles", () => {
        zxcvbnScore(3);
        const p = policy({ mode: PasswordPolicyMode.ZXCVBN });
        const { rerender } = render(<PasswordMeter value={"whatever"} policy={p} />);
        expect(bar()).toHaveAttribute("aria-valuemax", "4");
        expect(bar()).toHaveAttribute("aria-valuenow", "3");
        expect(screen.getByText("Strength: Good")).toBeInTheDocument();
        zxcvbnScore(4);
        rerender(<PasswordMeter value={"whatever2"} policy={p} />);
        expect(screen.getByText("Strength: Strong")).toBeInTheDocument();
    });

    it("sin contraseña escrita no muestra el nivel en texto", () => {
        render(<PasswordMeter value={""} policy={policy({ min_length: 8 })} />);
        expect(bar()).toHaveAttribute("aria-valuenow", "0");
        expect(screen.queryByText(/^Strength:/)).not.toBeInTheDocument();
    });

    it("sin política: barra en 0 y sin texto", () => {
        render(<PasswordMeter value={"abc"} />);
        expect(bar()).toHaveAttribute("aria-valuenow", "0");
        expect(bar()).toHaveAttribute("aria-valuemax", "3");
        expect(screen.queryByText(/^Strength:/)).not.toBeInTheDocument();
    });
});
