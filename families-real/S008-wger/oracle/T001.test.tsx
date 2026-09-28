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

// T001 — Botón de cierre accesible y diálogo con título y descripción.
describe("T001 · cierre accesible", () => {
    test("el icono de cierre es un botón con nombre accesible que cierra el diálogo", async () => {
        const user = userEvent.setup();
        const props = baseProps();
        render(<DeleteConfirmationModal {...props} />);
        await user.click(screen.getByRole("button", { name: "closeDialog" }));
        expect(props.closeFn).toHaveBeenCalledTimes(1);
        expect(props.deleteFn).not.toHaveBeenCalled();
    });

    test("el título y el mensaje tienen los ids que usa el modal", () => {
        render(<DeleteConfirmationModal {...baseProps()} />);
        expect(document.getElementById("modal-modal-title")).toHaveTextContent("Delete routine?");
        expect(document.getElementById("modal-modal-description")).toHaveTextContent(
            "All sessions of this routine will be deleted too"
        );
    });

    test("la traducción en inglés existe", () => {
        expect(translations.closeDialog).toBe("Close dialog");
    });
});
