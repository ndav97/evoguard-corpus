import {
    DeleteConfirmationModal,
    DeleteConfirmationModalProps
} from "@/core/ui/Modals/DeleteConfirmationModal";
import en from "@/locales/en/translation.json";
import { render, screen } from '@testing-library/react';
import userEvent from "@testing-library/user-event";

const baseProps = (overrides: Partial<DeleteConfirmationModalProps> = {}): DeleteConfirmationModalProps => ({
    title: "Delete routine?",
    subtitle: "Push day",
    message: "All sessions of this routine will be deleted too",
    isOpen: true,
    closeFn: vi.fn(),
    deleteFn: vi.fn(),
    ...overrides,
});

const translations = en as Record<string, string>;

// T002 — Confirmación escribiendo un texto.
describe("T002 · confirmar escribiendo", () => {
    const deleteButton = () => screen.getByRole("button", { name: "delete" });

    test("con confirmationText, «delete» empieza deshabilitado", () => {
        render(<DeleteConfirmationModal {...baseProps({ confirmationText: "Push day" })} />);
        expect(screen.getByLabelText("deleteConfirmationPrompt")).toHaveValue("");
        expect(deleteButton()).toBeDisabled();
    });

    test("solo se habilita con el texto exacto (ignorando espacios de los extremos)", async () => {
        const user = userEvent.setup();
        const props = baseProps({ confirmationText: "Push day" });
        render(<DeleteConfirmationModal {...props} />);
        const field = screen.getByLabelText("deleteConfirmationPrompt");
        await user.type(field, "push day");
        expect(deleteButton()).toBeDisabled();
        await user.clear(field);
        await user.type(field, "  Push day ");
        expect(deleteButton()).toBeEnabled();
        await user.click(deleteButton());
        expect(props.deleteFn).toHaveBeenCalledTimes(1);
    });

    test("sin confirmationText no hay campo y se puede borrar directamente", () => {
        render(<DeleteConfirmationModal {...baseProps()} />);
        expect(screen.queryByLabelText("deleteConfirmationPrompt")).not.toBeInTheDocument();
        expect(deleteButton()).toBeEnabled();
    });

    test("al cerrar y volver a abrir, el campo empieza vacío", async () => {
        const user = userEvent.setup();
        const props = baseProps({ confirmationText: "Push day" });
        const { rerender } = render(<DeleteConfirmationModal {...props} />);
        await user.type(screen.getByLabelText("deleteConfirmationPrompt"), "Push day");
        rerender(<DeleteConfirmationModal {...props} isOpen={false} />);
        rerender(<DeleteConfirmationModal {...props} isOpen={true} />);
        expect(screen.getByLabelText("deleteConfirmationPrompt")).toHaveValue("");
        expect(deleteButton()).toBeDisabled();
    });

    test("la traducción en inglés existe e incluye {{text}}", () => {
        expect(translations.deleteConfirmationPrompt).toContain("{{text}}");
    });
});
