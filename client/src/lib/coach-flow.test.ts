import { describe, expect, it } from "vitest";
import { coachCompletionMessage, coachGoalLabel, coachPromptForGoal, coachStepAfterGoalSelection } from "./coach-flow";

describe("antrenorul financiar — siguranța financiară", () => {
  it("pornește pasul de analiză cu întrebarea corectă", () => {
    const transition = coachStepAfterGoalSelection("siguranta");
    expect(transition).toEqual({
      step: 2,
      goal: "siguranta",
      prompt: "Cum arată bilanțul meu?",
      label: "siguranța financiară",
      mutatesData: false,
    });
  });

  it("păstrează mesajele explicabile pentru obiectiv", () => {
    expect(coachGoalLabel("siguranta")).toBe("siguranța financiară");
    expect(coachPromptForGoal("siguranta")).toBe("Cum arată bilanțul meu?");
    expect(coachCompletionMessage("siguranta")).toContain("verifică siguranța financiară");
  });
});
