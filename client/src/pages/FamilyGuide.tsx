/** Ghidul. Scos din home-secondary. */
import "../family-guide.css";
import { type MainView } from "@/pages/home-kit";
import { UsageTutorial } from "@/components/UsageTutorial";

export function FamilyGuide({ onGo, onOpenReview, onOpenSync }: { onGo?: (view: MainView) => void; onOpenReview?: () => void; onOpenSync?: () => void }) {
  return <UsageTutorial onGo={onGo} onOpenReview={onOpenReview} onOpenSync={onOpenSync} />;
}
