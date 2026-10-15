import {
    DeleteConfirmationModal,
    DeleteConfirmationModalProps
} from "@/core/ui/Modals/DeleteConfirmationModal";
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

const pendingDelete = () => {
    let resolve: () => void = () => {};
    let reject: (e: Error) => void = () => {};
    const promise = new Promise<void>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { fn: vi.fn(() => promise), resolve: () => resolve(), reject: (e: Error) => reject(e) };
};

// T004 — El diálogo no se puede cerrar mientras se borra.
describe("T004 · sin cerrar durante el borrado", () => {
    test("mientras se borra, los dos botones de cierre están deshabilitados", async () => {
        const user = userEvent.setup();
        const del = pendingDelete();
        const props = baseProps({ deleteFn: del.fn });
        render(<DeleteConfirmationModal {...props} />);
        await user.click(screen.getByRole("button", { name: "delete" }));
        expect(screen.getByRole("button", { name: "closeDialog" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "close" })).toBeDisabled();
    });

    test("Escape no cierra el diálogo mientras se borra", async () => {
        const user = userEvent.setup();
        const del = pendingDelete();
        const props = baseProps({ deleteFn: del.fn });
        render(<DeleteConfirmationModal {...props} />);
        await user.click(screen.getByRole("button", { name: "delete" }));
        fireEvent.keyDown(screen.getByText("All sessions of this routine will be deleted too"), { key: "Escape" });
        expect(props.closeFn).not.toHaveBeenCalled();
    });

    test("sin borrado en curso, Escape y los botones de cierre siguen cerrando", async () => {
        const user = userEvent.setup();
        const props = baseProps();
        render(<DeleteConfirmationModal {...props} />);
        fireEvent.keyDown(screen.getByText("All sessions of this routine will be deleted too"), { key: "Escape" });
        expect(props.closeFn).toHaveBeenCalledTimes(1);
        await user.click(screen.getByRole("button", { name: "closeDialog" }));
        await user.click(screen.getByRole("button", { name: "close" }));
        expect(props.closeFn).toHaveBeenCalledTimes(3);
    });

    test("si el borrado falla, se puede volver a cerrar", async () => {
        const user = userEvent.setup();
        const del = pendingDelete();
        const props = baseProps({ deleteFn: del.fn });
        render(<DeleteConfirmationModal {...props} />);
        await user.click(screen.getByRole("button", { name: "delete" }));
        del.reject(new Error("boom"));
        expect(await screen.findByRole("alert")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "close" })).toBeEnabled();
        await user.click(screen.getByRole("button", { name: "closeDialog" }));
        expect(props.closeFn).toHaveBeenCalledTimes(1);
    });

    test("si el borrado termina bien, se cierra una sola vez", async () => {
        const user = userEvent.setup();
        const del = pendingDelete();
        const props = baseProps({ deleteFn: del.fn });
        render(<DeleteConfirmationModal {...props} />);
        await user.click(screen.getByRole("button", { name: "delete" }));
        del.resolve();
        await waitFor(() => expect(props.closeFn).toHaveBeenCalledTimes(1));
    });
});
