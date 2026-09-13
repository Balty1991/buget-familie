type ChatLike = {
  id: string;
  role: "assistant" | "user";
  choices?: unknown[];
  picks?: unknown[];
  action?: { type: string };
};

const isOpenSituation = (item: ChatLike | undefined) => Boolean(item && item.role === "assistant" && (item.choices?.length || item.picks?.length || item.action?.type === "apply"));

/** Implicit vedem doar turul curent; istoricul se deschide la cerere. După o salvare rămâne confirmarea. */
export const shownChatMessages = <T extends ChatLike>(messages: T[], historyOpen: boolean): T[] => {
  if (historyOpen || messages.length <= 1) return messages;
  const last = messages[messages.length - 1];
  if (last.role === "assistant" && !isOpenSituation(last)) return messages.slice(-1);
  let from = 0;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === "user") { from = i; break; }
  }
  return messages.slice(from);
};
