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

// T003 — Normalización al salir de un campo y al enviar.
describe("T003 · normalización", () => {
  it("al enviar, los milisegundos sobrantes pasan a segundos", async () => {
    const user = renderForm();
    await setField(user, "ms", "1500");
    await user.click(screen.getByRole("button", { name: "Start" }));
    expect(submittedAction()).toBe("shift_offset(h=0,m=0,s=1,ms=500)");
  });

  it("al salir de un campo se reparten los valores", async () => {
    const user = renderForm();
    await setField(user, "ms", "2500");
    await user.tab();
    expect(screen.getByLabelText("sec")).toHaveValue("2");
    expect(screen.getByLabelText("ms")).toHaveValue("500");
  });

  it("en sentido negativo se niegan los valores ya normalizados", async () => {
    const user = renderForm();
    await user.click(screen.getByRole("button", { name: "Shift later" }));
    await setField(user, "sec", "90");
    await user.click(screen.getByRole("button", { name: "Start" }));
    expect(submittedAction()).toBe("shift_offset(h=0,m=-1,s=-30,ms=0)");
  });

  it("las horas no tienen tope", async () => {
    const user = renderForm();
    await setField(user, "min", "150");
    await user.click(screen.getByRole("button", { name: "Start" }));
    expect(submittedAction()).toBe("shift_offset(h=2,m=30,s=0,ms=0)");
  });
});
