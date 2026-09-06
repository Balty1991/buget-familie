export type CoachGoal = "ritm" | "cheltuieli" | "plan" | "siguranta" | "repartizare" | "cheltuiala";

export const coachGoalLabel = (goal: CoachGoal) => goal === "ritm" ? "ritmul până la venit" : goal === "cheltuieli" ? "cheltuielile principale" : goal === "plan" ? "planul pe plicuri" : goal === "siguranta" ? "siguranța financiară" : goal === "repartizare" ? "repartizarea banilor" : "adăugarea cheltuielii";

export const coachPromptForGoal = (goal: CoachGoal) => goal === "ritm" ? "Care este prognoza până la salariu?" : goal === "cheltuieli" ? "Pe ce cheltuim cel mai mult?" : goal === "plan" ? "Cum arată planul meu?" : goal === "siguranta" ? "Cum arată bilanțul meu?" : goal === "repartizare" ? "Cum împărțim banii disponibili?" : "Cum adaug o cheltuială?";

export const coachCompletionMessage = (goal: CoachGoal) => `Ține minte o singură acțiune: verifică ${coachGoalLabel(goal)} înainte de următoarea cheltuială importantă.`;

export function coachStepAfterGoalSelection(goal: CoachGoal) {
  return { step: 2 as const, goal, prompt: coachPromptForGoal(goal), label: coachGoalLabel(goal), mutatesData: false };
}
