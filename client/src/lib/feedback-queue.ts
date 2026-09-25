/**
 * Doar cheia cozii de feedback, fără nimic altceva: la pornire se verifică dacă a rămas un
 * mesaj netrimis. Modulul „feedback” trage după el sincronizarea (Firebase); fără coadă,
 * nu are de ce să se încarce.
 */
export const FEEDBACK_QUEUE_KEY = "buget-familie:feedback-queue-v1";

export const hasQueuedFeedback = () => {
  try {
    return (window.localStorage.getItem(FEEDBACK_QUEUE_KEY) || "[]") !== "[]";
  } catch {
    return false;
  }
};
