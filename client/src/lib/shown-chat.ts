type ChatLike = {
  id: string;
  role: "assistant" | "user";
  choices?: unknown[];
  picks?: unknown[];
  action?: { type: string };
  undo?: unknown;
};

const isCompletedSave = (item: ChatLike | undefined) => Boolean(item && item.role === "assistant" && item.undo);
const isOpenSituation = (item: ChatLike | undefined) => Boolean(item && item.role === "assistant" && (item.choices?.length || item.picks?.length || item.action?.type === "apply"));

/** Implicit vedem turul curent. După salvare (cu undo) totul intra în Istoric. Răspunsurile și butoanele rămân vizibile. */
export const shownChatMessages = <T extends ChatLike>(messages: T[], historyOpen: boolean): T[] => {
  if (historyOpen) return messages;
  if (messages.length <= 1) return messages;
  const last = messages[messages.length - 1];
  if (isCompletedSave(last) && !isOpenSituation(last)) return [];
  let from = 0;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === "user") { from = i; break; }
  }
  return messages.slice(from);
};

export const hiddenChatCount = <T extends ChatLike>(messages: T[]) => Math.max(0, messages.length - shownChatMessages(messages, false).length);
