import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vitest } from "vitest";
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

const KEY = "bazarr-time-offset-last";
const lastButton = () => screen.queryByRole("button", { name: /^Use last offset/ });

// T005 — Recordar el último desplazamiento aplicado.
describe("T005 · último desplazamiento", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => window.localStorage.clear());

  it("sin desplazamiento guardado no muestra el botón", () => {
    renderForm();
    expect(lastButton()).not.toBeInTheDocument();
  });

  it("al enviar guarda el sentido y el total en milisegundos", async () => {
    const user = renderForm();
    await user.click(screen.getByRole("button", { name: "Shift later" }));
    await setField(user, "sec", "90");
    await user.click(screen.getByRole("button", { name: "Start" }));
    expect(JSON.parse(window.localStorage.getItem(KEY) ?? "null")).toEqual({ positive: false, total: 90000 });
  });

  it("con un desplazamiento guardado ofrece reutilizarlo", () => {
    window.localStorage.setItem(KEY, JSON.stringify({ positive: true, total: 3723456 }));
    renderForm();
    expect(lastButton()).toHaveAccessibleName("Use last offset (+01:02:03.456)");
    expect(screen.getAllByRole("button")[0]).toHaveAccessibleName("Shift later");
  });

  it("al pulsarlo rellena los campos y el sentido", async () => {
    window.localStorage.setItem(KEY, JSON.stringify({ positive: false, total: 1500 }));
    const user = renderForm();
    expect(lastButton()).toHaveAccessibleName("Use last offset (-00:00:01.500)");
    await user.click(lastButton()!);
    expect(screen.getByRole("button", { name: "Shift earlier" })).toBeInTheDocument();
    expect(screen.getByLabelText("sec")).toHaveValue("1");
    expect(screen.getByLabelText("ms")).toHaveValue("500");
    await user.click(screen.getByRole("button", { name: "Start" }));
    expect(submittedAction()).toBe("shift_offset(h=0,m=0,s=-1,ms=-500)");
  });

  it("ignora valores guardados no válidos", () => {
    for (const bad of ["not json", JSON.stringify({ positive: "yes", total: 10 }), JSON.stringify({ positive: true, total: 0 })]) {
      window.localStorage.setItem(KEY, bad);
      const { unmount } = customRender(<TimeOffsetForm selections={[selection]} />);
      expect(lastButton()).not.toBeInTheDocument();
      unmount();
    }
  });

  it("el envío guarda el total normalizado", async () => {
    const user = renderForm();
    await setField(user, "ms", "2500");
    await user.click(screen.getByRole("button", { name: "Start" }));
    expect(JSON.parse(window.localStorage.getItem(KEY) ?? "null")).toEqual({ positive: true, total: 2500 });
  });
});
