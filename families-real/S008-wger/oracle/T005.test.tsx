import {
    DeleteConfirmationModal,
    DeleteConfirmationModalProps
} from "@/core/ui/Modals/DeleteConfirmationModal";
import en from "@/locales/en/translation.json";
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

const translations = en as Record<string, string>;

const field = () => screen.getByLabelText("deleteConfirmationPrompt");

// T005 — Enter en el campo de confirmación borra.
describe("T005 · confirmar con Enter", () => {
    test("con el texto correcto, Enter borra y cierra", async () => {
        const user = userEvent.setup();
        const props = baseProps({ confirmationText: "Push day" });
        render(<DeleteConfirmationModal {...props} />);
        await user.type(field(), " Push day {Enter}");
        expect(props.deleteFn).toHaveBeenCalledTimes(1);
        expect(props.closeFn).toHaveBeenCalledTimes(1);
    });

    test("con el texto incorrecto, Enter no hace nada", async () => {
        const user = userEvent.setup();
        const props = baseProps({ confirmationText: "Push day" });
        render(<DeleteConfirmationModal {...props} />);
        await user.type(field(), "push day{Enter}");
        expect(props.deleteFn).not.toHaveBeenCalled();
        expect(props.closeFn).not.toHaveBeenCalled();
        expect(field()).toHaveValue("push day");
    });

    test("con un borrado asíncrono, Enter entra en espera", async () => {
        const user = userEvent.setup();
        const props = baseProps({ confirmationText: "Legs", deleteFn: vi.fn(() => new Promise<void>(() => {})) });
        render(<DeleteConfirmationModal {...props} />);
        await user.type(field(), "Legs{Enter}");
        expect(screen.getByRole("button", { name: "deleting" })).toBeDisabled();
        expect(props.closeFn).not.toHaveBeenCalled();
    });

    test("mientras se borra, otro Enter no repite el borrado", async () => {
        const user = userEvent.setup();
        const props = baseProps({ confirmationText: "Legs", deleteFn: vi.fn(() => new Promise<void>(() => {})) });
        render(<DeleteConfirmationModal {...props} />);
        await user.type(field(), "Legs{Enter}");
        await user.type(field(), "{Enter}");
        expect(props.deleteFn).toHaveBeenCalledTimes(1);
    });

    test("tras un fallo, Enter reintenta", async () => {
        const user = userEvent.setup();
        const deleteFn = vi.fn()
            .mockImplementationOnce(() => Promise.reject(new Error("boom")))
            .mockImplementationOnce(() => Promise.resolve());
        const props = baseProps({ confirmationText: "Legs", deleteFn });
        render(<DeleteConfirmationModal {...props} />);
        await user.type(field(), "Legs{Enter}");
        expect(await screen.findByRole("alert")).toBeInTheDocument();
        await user.type(field(), "{Enter}");
        await waitFor(() => expect(props.closeFn).toHaveBeenCalledTimes(1));
        expect(deleteFn).toHaveBeenCalledTimes(2);
    });
});
