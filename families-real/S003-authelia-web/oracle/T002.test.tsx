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

// T002 — Lista de requisitos de la política estándar.
describe("T002 · lista de requisitos", () => {
    const items = () =>
        Array.from(screen.getByRole("list", { name: "Password requirements" }).querySelectorAll("li")).map(
            (li) => li.textContent,
        );
    const full = policy({
        min_length: 8,
        require_lowercase: true,
        require_number: true,
        require_special: true,
        require_uppercase: true,
    });

    it("marca cada requisito como cumplido o no, en el orden indicado", () => {
        render(<PasswordMeter value={"abc"} policy={full} />);
        expect(items()).toEqual([
            "✗ At least 8 characters",
            "✓ One lowercase letter",
            "✗ One uppercase letter",
            "✗ One number",
            "✗ One special character",
        ]);
    });

    it("incluye la longitud máxima cuando la política la define", () => {
        render(<PasswordMeter value={"abcdefgh"} policy={policy({ max_length: 6, min_length: 4 })} />);
        expect(items()).toEqual(["✓ At least 4 characters", "✗ At most 6 characters"]);
    });

    it("todo cumplido, y el nivel sigue mostrándose", () => {
        render(<PasswordMeter value={"Abcdefg1!"} policy={full} />);
        expect(items().every((t) => t?.startsWith("✓ "))).toBe(true);
        expect(screen.getByText("Strength: Strong")).toBeInTheDocument();
    });

    it("se muestra aunque no se haya escrito nada", () => {
        render(<PasswordMeter value={""} policy={full} />);
        expect(items()).toHaveLength(5);
        expect(items().every((t) => t?.startsWith("✗ "))).toBe(true);
    });

    it("no aparece en modo ZXCVBN, sin requisitos ni sin política", () => {
        zxcvbnScore(2);
        const { rerender } = render(<PasswordMeter value={"abc"} policy={policy({ mode: PasswordPolicyMode.ZXCVBN })} />);
        expect(screen.queryByRole("list", { name: "Password requirements" })).not.toBeInTheDocument();
        rerender(<PasswordMeter value={"abc"} policy={policy()} />);
        expect(screen.queryByRole("list", { name: "Password requirements" })).not.toBeInTheDocument();
        rerender(<PasswordMeter value={"abc"} />);
        expect(screen.queryByRole("list", { name: "Password requirements" })).not.toBeInTheDocument();
    });
});
