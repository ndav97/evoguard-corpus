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

// T004 — Ajustes rápidos negativos.
describe("T004 · restar con los ajustes rápidos", () => {
  it("ofrece -100 ms, -1 s y -1 min sin dejar de ser primero el botón de dirección", () => {
    renderForm();
    for (const name of ["-100 ms", "-1 s", "-1 min"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
    expect(screen.getAllByRole("button")[0]).toHaveAccessibleName("Shift later");
  });

  it("restan del total y lo reparten entre los campos", async () => {
    const user = renderForm();
    await setField(user, "min", "1");
    await user.click(screen.getByRole("button", { name: "-100 ms" }));
    expect(screen.getByLabelText("min")).toHaveValue("0");
    expect(screen.getByLabelText("sec")).toHaveValue("59");
    expect(screen.getByLabelText("ms")).toHaveValue("900");
    expect(screen.getByText("Offset: +00:00:59.900")).toBeInTheDocument();
  });

  it("restar más de lo que hay deja todo en cero y deshabilita «Start»", async () => {
    const user = renderForm();
    await user.click(screen.getByRole("button", { name: "+1 s" }));
    await user.click(screen.getByRole("button", { name: "-1 min" }));
    for (const label of ["hour", "min", "sec", "ms"]) {
      expect(screen.getByLabelText(label)).toHaveValue("0");
    }
    expect(screen.queryByText(/^Offset:/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start" })).toBeDisabled();
  });

  it("las horas bajan a minutos", async () => {
    const user = renderForm();
    await setField(user, "hour", "1");
    await user.click(screen.getByRole("button", { name: "-1 s" }));
    expect(screen.getByLabelText("hour")).toHaveValue("0");
    expect(screen.getByLabelText("min")).toHaveValue("59");
    expect(screen.getByLabelText("sec")).toHaveValue("59");
  });

  it("no cambian el sentido y se envía con el signo elegido", async () => {
    const user = renderForm();
    await user.click(screen.getByRole("button", { name: "Shift later" }));
    await user.click(screen.getByRole("button", { name: "+1 min" }));
    await user.click(screen.getByRole("button", { name: "-1 s" }));
    expect(screen.getByRole("button", { name: "Shift earlier" })).toBeInTheDocument();
    expect(screen.getByText("Offset: -00:00:59.000")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Start" }));
    expect(submittedAction()).toBe("shift_offset(h=0,m=0,s=-59,ms=0)");
  });
});
