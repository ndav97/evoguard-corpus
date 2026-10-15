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

// T004 — La contraseña no puede contener el nombre de usuario.
describe("T004 · no contener el nombre de usuario", () => {
    it("modo estándar: añade el requisito al final de la lista", () => {
        render(<PasswordMeter value={"Secret1"} policy={policy({ min_length: 6 })} username={"alice"} />);
        expect(items()).toEqual(["✓ At least 6 characters", "✓ Does not contain your username"]);
    });

    it("modo estándar: lo marca como incumplido sin distinguir mayúsculas ni espacios del usuario", () => {
        render(<PasswordMeter value={"myALICE2026"} policy={policy({ min_length: 6 })} username={" Alice "} />);
        expect(items()).toEqual(["✓ At least 6 characters", "✗ Does not contain your username"]);
    });

    it("modo estándar: la lista aparece aunque la política no tenga otros requisitos", () => {
        render(<PasswordMeter value={""} policy={policy()} username={"bob"} />);
        expect(items()).toEqual(["✓ Does not contain your username"]);
    });

    it("sin usuario (o vacío) no añade el requisito", () => {
        const { rerender } = render(<PasswordMeter value={"abc"} policy={policy({ min_length: 2 })} />);
        expect(items()).toEqual(["✓ At least 2 characters"]);
        rerender(<PasswordMeter value={"abc"} policy={policy({ min_length: 2 })} username={"  "} />);
        expect(items()).toEqual(["✓ At least 2 characters"]);
    });

    it("modo estándar: contener el usuario hace inválida la contraseña", async () => {
        const onValidityChange = vi.fn();
        const p = policy({ min_length: 6 });
        const { rerender } = render(
            <PasswordMeter value={"bobby-2026"} policy={p} username={"bob"} onValidityChange={onValidityChange} />,
        );
        await waitFor(() => expect(onValidityChange).toHaveBeenLastCalledWith(false));
        rerender(<PasswordMeter value={"carol-2026"} policy={p} username={"bob"} onValidityChange={onValidityChange} />);
        await waitFor(() => expect(onValidityChange).toHaveBeenLastCalledWith(true));
    });

    it("modo ZXCVBN: avisa e invalida aunque la puntuación alcance el mínimo", async () => {
        zxcvbnScore(4);
        const onValidityChange = vi.fn();
        const p = policy({ min_score: 2, mode: PasswordPolicyMode.ZXCVBN });
        const { rerender } = render(
            <PasswordMeter value={"xx-Alice-yy"} policy={p} username={"alice"} onValidityChange={onValidityChange} />,
        );
        expect(screen.getByText("Must not contain your username")).toBeInTheDocument();
        await waitFor(() => expect(onValidityChange).toHaveBeenLastCalledWith(false));
        expect(screen.getByText("Strength: Strong")).toBeInTheDocument();
        expect(screen.queryByRole("list", { name: "Password requirements" })).not.toBeInTheDocument();

        rerender(<PasswordMeter value={"xx-yy-zz"} policy={p} username={"alice"} onValidityChange={onValidityChange} />);
        expect(screen.queryByText("Must not contain your username")).not.toBeInTheDocument();
        await waitFor(() => expect(onValidityChange).toHaveBeenLastCalledWith(true));
    });

    it("sin política o con la política desactivada no se comprueba", async () => {
        const onValidityChange = vi.fn();
        render(
            <PasswordMeter
                value={"alice"}
                policy={policy({ mode: PasswordPolicyMode.Disabled })}
                username={"alice"}
                onValidityChange={onValidityChange}
            />,
        );
        expect(screen.queryByText("Must not contain your username")).not.toBeInTheDocument();
        await waitFor(() => expect(onValidityChange).toHaveBeenLastCalledWith(true));
    });
});
