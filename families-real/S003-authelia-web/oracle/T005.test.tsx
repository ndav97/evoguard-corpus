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

const items = () =>
    Array.from(screen.getByRole("list", { name: "Password requirements" }).querySelectorAll("li")).map(
        (li) => li.textContent,
    );

// T005 — Resumen de requisitos cumplidos.
describe("T005 · resumen de requisitos", () => {
    const full = policy({ min_length: 8, require_number: true, require_uppercase: true });

    it("indica cuántos requisitos se cumplen", () => {
        render(<PasswordMeter value={"abc"} policy={full} />);
        expect(screen.getByText("0 of 3 requirements met")).toBeInTheDocument();
    });

    it("se actualiza al escribir", () => {
        const { rerender } = render(<PasswordMeter value={"Abc"} policy={full} />);
        expect(screen.getByText("1 of 3 requirements met")).toBeInTheDocument();
        rerender(<PasswordMeter value={"Abcdefgh"} policy={full} />);
        expect(screen.getByText("2 of 3 requirements met")).toBeInTheDocument();
    });

    it("con todo cumplido dice «All requirements met»", () => {
        render(<PasswordMeter value={"Abcdefg1"} policy={full} />);
        expect(screen.getByText("All requirements met")).toBeInTheDocument();
        expect(screen.queryByText(/^\d+ of \d+ requirements? met$/)).not.toBeInTheDocument();
    });

    it("usa el singular con un solo requisito", () => {
        render(<PasswordMeter value={""} policy={policy({ require_number: true })} />);
        expect(screen.getByText("0 of 1 requirement met")).toBeInTheDocument();
    });

    it("cuenta el requisito del nombre de usuario", () => {
        render(<PasswordMeter value={"Bob-12345"} policy={full} username={"bob"} />);
        expect(screen.getByText("3 of 4 requirements met")).toBeInTheDocument();
        expect(items()).toHaveLength(4);
    });

    it("no aparece sin lista de requisitos", () => {
        zxcvbnScore(1);
        const { rerender } = render(<PasswordMeter value={"abc"} policy={policy({ mode: PasswordPolicyMode.ZXCVBN })} />);
        expect(screen.queryByText(/requirements? met$/)).not.toBeInTheDocument();
        rerender(<PasswordMeter value={"abc"} policy={policy()} />);
        expect(screen.queryByText(/requirements? met$/)).not.toBeInTheDocument();
    });
});
