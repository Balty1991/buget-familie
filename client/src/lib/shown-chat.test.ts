import { describe, expect, it } from "vitest";
import { shownChatMessages, hiddenChatCount } from "./shown-chat";

const user = (id: string, text: string) => ({ id, role: "user" as const, text });
const assistant = (id: string, text: string, extra: Record<string, unknown> = {}) => ({ id, role: "assistant" as const, text, ...extra });

describe("istoricul ghidului se restrânge", () => {
  it("după salvare taxi-ul dispare din ecran, totul e în Istoric", () => {
    const messages = [
      assistant("w", "Bun venit"),
      user("u1", "Cheltuieli taxi 20 lei"),
      assistant("a1", "Alege din locurile unde sunt bani.", { choices: [{ label: "Din Alimente" }] }),
      assistant("a2", "Am salvat Taxi 20 RON.", { undo: { kind: "expense", title: "Taxi", amount: 20, date: "2026-09-13" }, action: { type: "journal", label: "Vezi în Mișcări" } }),
    ];
    expect(shownChatMessages(messages, false)).toEqual([]);
    expect(hiddenChatCount(messages)).toBe(4);
  });

  it("cât timp așteaptă o alegere, arată turul curent", () => {
    const messages = [
      assistant("w", "Bun venit"),
      user("u1", "Cheltuieli taxi 20 lei"),
      assistant("a1", "Alege plicul.", { choices: [{ label: "Din Alimente · S1" }] }),
    ];
    const shown = shownChatMessages(messages, false);
    expect(shown.map((item) => item.id)).toEqual(["u1", "a1"]);
  });

  it("la deschiderea istoricului se văd toate mesajele", () => {
    const messages = [assistant("w", "Bun venit"), user("u1", "ciao"), assistant("a1", "ok")];
    expect(shownChatMessages(messages, true)).toHaveLength(3);
  });

  it("butonul de istoric rămâne și după deschidere, ca să-l poți închide", () => {
    const messages = [
      assistant("w", "Bun venit"),
      user("u1", "Cheltuieli taxi 20 lei"),
      assistant("a1", "Alege plicul.", { choices: [{ label: "Din Alimente" }] }),
      assistant("a2", "Am salvat Taxi 20 RON."),
    ];
    expect(hiddenChatCount(messages)).toBeGreaterThan(0);
    expect(shownChatMessages(messages, true)).toHaveLength(messages.length);
  });

  it("un răspuns fără salvare rămâne pe ecran, inclusiv butonul de formular", () => {
    const answer = [
      assistant("w", "Bun venit"),
      user("u1", "Cât mai am în Alimente?"),
      assistant("a1", "În Alimente mai sunt 180 lei."),
    ];
    expect(shownChatMessages(answer, false).map((item) => item.id)).toEqual(["u1", "a1"]);

    const cta = [
      assistant("w", "Bun venit"),
      user("u2", "Adaugă o mișcare"),
      assistant("a2", "Deschid formularul.", { action: { type: "add", label: "Deschide formularul" } }),
    ];
    expect(shownChatMessages(cta, false).map((item) => item.id)).toEqual(["u2", "a2"]);
  });
});
