import {
    DeleteConfirmationModal,
    DeleteConfirmationModalProps
} from "@/core/ui/Modals/DeleteConfirmationModal";
import en from "@/locales/en/translation.json";
import { render, screen, waitFor } from '@testing-library/react';
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

// T003 — Borrado asíncrono: espera, error y reintento.
describe("T003 · borrado asíncrono", () => {
    test("mientras la promesa está pendiente, el botón muestra «deleting» deshabilitado y no se cierra", async () => {
        const user = userEvent.setup();
        const props = baseProps({ deleteFn: vi.fn(() => new Promise<void>(() => {})) });
        render(<DeleteConfirmationModal {...props} />);
        await user.click(screen.getByRole("button", { name: "delete" }));
        expect(screen.getByRole("button", { name: "deleting" })).toBeDisabled();
        expect(props.closeFn).not.toHaveBeenCalled();
    });

    test("cuando la promesa se resuelve, se cierra", async () => {
        const user = userEvent.setup();
        const props = baseProps({ deleteFn: vi.fn(() => Promise.resolve()) });
        render(<DeleteConfirmationModal {...props} />);
        await user.click(screen.getByRole("button", { name: "delete" }));
        await waitFor(() => expect(props.closeFn).toHaveBeenCalledTimes(1));
    });

    test("si la promesa falla, muestra un aviso, no se cierra y permite reintentar", async () => {
        const user = userEvent.setup();
        const props = baseProps({ deleteFn: vi.fn(() => Promise.reject(new Error("boom"))) });
        render(<DeleteConfirmationModal {...props} />);
        await user.click(screen.getByRole("button", { name: "delete" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("deleteFailed");
        expect(screen.getByRole("alert")).toHaveTextContent(/^deleteFailed$/);
        expect(props.closeFn).not.toHaveBeenCalled();
        expect(screen.getByRole("button", { name: "delete" })).toBeEnabled();
    });

    // Añadidos tras la prueba de mutantes (2026-09-29).
    test("sin un borrado fallido no se muestra ningún aviso", () => {
        render(<DeleteConfirmationModal {...baseProps()} />);
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "delete" })).toBeEnabled();
    });

    test("al cerrar y volver a abrir desaparece el aviso de error", async () => {
        const user = userEvent.setup();
        const props = baseProps({ deleteFn: vi.fn(() => Promise.reject(new Error("boom"))) });
        const { rerender } = render(<DeleteConfirmationModal {...props} />);
        await user.click(screen.getByRole("button", { name: "delete" }));
        expect(await screen.findByRole("alert")).toBeInTheDocument();
        rerender(<DeleteConfirmationModal {...props} isOpen={false} />);
        rerender(<DeleteConfirmationModal {...props} isOpen={true} />);
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "delete" })).toBeEnabled();
    });

    test("un deleteFn síncrono sigue cerrando en el acto", async () => {
        const user = userEvent.setup();
        const props = baseProps();
        render(<DeleteConfirmationModal {...props} />);
        await user.click(screen.getByRole("button", { name: "delete" }));
        expect(props.deleteFn).toHaveBeenCalledTimes(1);
        expect(props.closeFn).toHaveBeenCalledTimes(1);
    });

    test("las traducciones en inglés existen", () => {
        expect(translations.deleting).toBeTruthy();
        expect(translations.deleteFailed).toBeTruthy();
    });
});
