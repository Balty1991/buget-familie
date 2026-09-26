/**
 * Culoarea fiecărui membru: punctul de lângă mișcările lui. Fără alegere, membrii primesc
 * pe rând culorile din paletă, ca doi oameni să nu arate la fel.
 */
import type { AppData, FamilyMember } from "@/lib/finance-data";

export const MEMBER_COLORS = [
  { value: "#256B5B", name: "Verde" },
  { value: "#2F6FD6", name: "Albastru" },
  { value: "#C2473C", name: "Roșu" },
  { value: "#B07D12", name: "Muștar" },
  { value: "#7A4FB3", name: "Mov" },
  { value: "#1E8A99", name: "Turcoaz" },
] as const;

export function memberColor(members: FamilyMember[], memberId?: string): string | undefined {
  const index = members.findIndex((item) => item.id === memberId);
  if (index < 0) return undefined;
  return members[index].color || MEMBER_COLORS[index % MEMBER_COLORS.length].value;
}

export function nextMemberColor(current: string | undefined): string {
  const at = MEMBER_COLORS.findIndex((item) => item.value.toLowerCase() === (current || "").toLowerCase());
  return MEMBER_COLORS[(at + 1) % MEMBER_COLORS.length].value;
}

export const memberColorName = (value: string | undefined) => MEMBER_COLORS.find((item) => item.value.toLowerCase() === (value || "").toLowerCase())?.name || "";

export const colorFor = (data: AppData, memberId?: string) => data.settings.members.length > 1 ? memberColor(data.settings.members, memberId) : undefined;
