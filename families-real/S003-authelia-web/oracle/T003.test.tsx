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

// T003 — Puntuación mínima y aviso de validez al componente padre.
describe("T003 · validez y puntuación mínima", () => {
    it("modo estándar: informa false mientras falte algo y true cuando se cumple todo", async () => {
        const onValidityChange = vi.fn();
        const p = policy({ min_length: 6, require_number: true });
        const { rerender } = render(<PasswordMeter value={"abc"} policy={p} onValidityChange={onValidityChange} />);
        await waitFor(() => expect(onValidityChange).toHaveBeenLastCalledWith(false));
        rerender(<PasswordMeter value={"abcde1"} policy={p} onValidityChange={onValidityChange} />);
        await waitFor(() => expect(onValidityChange).toHaveBeenLastCalledWith(true));
    });

    it("la longitud máxima también cuenta", async () => {
        const onValidityChange = vi.fn();
        render(<PasswordMeter value={"abcdefgh"} policy={policy({ max_length: 6 })} onValidityChange={onValidityChange} />);
        await waitFor(() => expect(onValidityChange).toHaveBeenLastCalledWith(false));
    });

    it("modo ZXCVBN: por debajo de min_score es inválida y lo indica", async () => {
        zxcvbnScore(2);
        const onValidityChange = vi.fn();
        const p = policy({ min_score: 3, mode: PasswordPolicyMode.ZXCVBN });
        const { rerender } = render(<PasswordMeter value={"abc"} policy={p} onValidityChange={onValidityChange} />);
        await waitFor(() => expect(onValidityChange).toHaveBeenLastCalledWith(false));
        expect(screen.getByText("Minimum strength required: Good")).toBeInTheDocument();

        zxcvbnScore(3);
        rerender(<PasswordMeter value={"abcd"} policy={p} onValidityChange={onValidityChange} />);
        await waitFor(() => expect(onValidityChange).toHaveBeenLastCalledWith(true));
        expect(screen.queryByText(/^Minimum strength required/)).not.toBeInTheDocument();
    });

    it("no muestra el aviso de mínimo si no se ha escrito nada", () => {
        zxcvbnScore(0);
        render(<PasswordMeter value={""} policy={policy({ min_score: 2, mode: PasswordPolicyMode.ZXCVBN })} />);
        expect(screen.queryByText(/^Minimum strength required/)).not.toBeInTheDocument();
    });

    it("sin política siempre es válida", async () => {
        const onValidityChange = vi.fn();
        render(<PasswordMeter value={""} onValidityChange={onValidityChange} />);
        await waitFor(() => expect(onValidityChange).toHaveBeenLastCalledWith(true));
    });

    it("el modo estándar nunca muestra el aviso de mínimo", () => {
        render(<PasswordMeter value={"a"} policy={policy({ min_length: 4, min_score: 4 })} />);
        expect(screen.queryByText(/^Minimum strength required/)).not.toBeInTheDocument();
        expect(screen.getByRole("list", { name: "Password requirements" })).toBeInTheDocument();
    });
});
