import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vitest } from "vitest";
import { useSubtitleAction } from "@/apis/hooks";
import TimeOffsetForm from "@/components/forms/TimeOffsetForm";
import { useModals } from "@/modules/modals";
import { task } from "@/modules/task";
import { customRender, screen } from "@/tests";

vitest.mock("@/apis/hooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/apis/hooks")>();
  return { ...actual, useSubtitleAction: vitest.fn() };
});

vitest.mock("@/modules/modals", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/modals")>();
  return { ...actual, useModals: vitest.fn() };
});

vitest.mock("@/modules/task", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/task")>();
  return { ...actual, task: { create: vitest.fn() } };
});

const selection = {
  id: 1,
  subtitlesId: 2,
  type: "episode",
  language: "en",
  path: "/subtitles/sub.srt",
  hi: "False",
  forced: "False",
} as FormType.ModifySubtitle;

beforeEach(() => {
  vitest.clearAllMocks();
  vitest.mocked(useModals).mockReturnValue({
    closeSelf: vitest.fn(),
  } as unknown as ReturnType<typeof useModals>);
  vitest.mocked(useSubtitleAction).mockReturnValue({
    mutateAsync: vitest.fn(),
  } as unknown as ReturnType<typeof useSubtitleAction>);
});

const renderForm = () => {
  customRender(<TimeOffsetForm selections={[selection]} />);
  return userEvent.setup();
};

const setField = async (
  user: ReturnType<typeof userEvent.setup>,
  label: string,
  value: string,
) => {
  await user.clear(screen.getByLabelText(label));
  await user.type(screen.getByLabelText(label), value);
};

const submittedAction = () =>
  (vitest.mocked(task.create).mock.calls[0]?.[3] as { action: string })
    ?.action;

// T001 — Botón de dirección accesible y resumen del desplazamiento.
describe("T001 · dirección y resumen", () => {
  it("el botón de dirección tiene nombre accesible según el sentido", async () => {
    const user = renderForm();
    await user.click(screen.getByRole("button", { name: "Shift later" }));
    expect(screen.getByRole("button", { name: "Shift earlier" })).toBeInTheDocument();
  });

  it("sin desplazamiento no hay resumen", () => {
    renderForm();
    expect(screen.queryByText(/^Offset:/)).not.toBeInTheDocument();
  });

  it("muestra el desplazamiento con signo y formato HH:MM:SS.mmm", async () => {
    const user = renderForm();
    await setField(user, "hour", "1");
    await setField(user, "min", "5");
    expect(screen.getByText("Offset: +01:05:00.000")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Shift later" }));
    expect(screen.getByText("Offset: -01:05:00.000")).toBeInTheDocument();
  });

  it("el resumen normaliza los valores que se pasan de rango", async () => {
    const user = renderForm();
    await setField(user, "min", "75");
    expect(screen.getByText("Offset: +01:15:00.000")).toBeInTheDocument();
  });

  it("incluye segundos y milisegundos", async () => {
    const user = renderForm();
    await setField(user, "sec", "3");
    await setField(user, "ms", "250");
    expect(screen.getByText("Offset: +00:00:03.250")).toBeInTheDocument();
  });
});
