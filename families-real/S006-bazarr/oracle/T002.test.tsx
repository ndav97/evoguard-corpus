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

// T002 — Botones de ajuste rápido.
describe("T002 · ajustes rápidos", () => {
  it("ofrece +100 ms, +1 s y +1 min, después del botón de dirección", () => {
    renderForm();
    for (const name of ["+100 ms", "+1 s", "+1 min"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
    expect(screen.getAllByRole("button")[0]).toHaveAccessibleName("Shift later");
  });

  it("suman al desplazamiento y reparten el total entre los campos", async () => {
    const user = renderForm();
    await user.click(screen.getByRole("button", { name: "+1 s" }));
    await user.click(screen.getByRole("button", { name: "+100 ms" }));
    expect(screen.getByLabelText("sec")).toHaveValue("1");
    expect(screen.getByLabelText("ms")).toHaveValue("100");
    expect(screen.getByText("Offset: +00:00:01.100")).toBeInTheDocument();
  });

  it("los milisegundos pasan a segundos al llegar a 1000", async () => {
    const user = renderForm();
    for (let i = 0; i < 10; i++) {
      await user.click(screen.getByRole("button", { name: "+100 ms" }));
    }
    expect(screen.getByLabelText("sec")).toHaveValue("1");
    expect(screen.getByLabelText("ms")).toHaveValue("0");
  });

  it("los minutos pasan a horas", async () => {
    const user = renderForm();
    await setField(user, "min", "59");
    await user.click(screen.getByRole("button", { name: "+1 min" }));
    expect(screen.getByLabelText("hour")).toHaveValue("1");
    expect(screen.getByLabelText("min")).toHaveValue("0");
  });

  it("un ajuste rápido habilita «Start» y se envía", async () => {
    const user = renderForm();
    expect(screen.getByRole("button", { name: "Start" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "+1 s" }));
    await user.click(screen.getByRole("button", { name: "Start" }));
    expect(submittedAction()).toBe("shift_offset(h=0,m=0,s=1,ms=0)");
  });
});
