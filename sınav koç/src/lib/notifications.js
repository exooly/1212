/**
 * Bildirim mimarisi — V1'de aktif push bildirimi yok.
 * İleride eklendiğinde bu katman kullanılacak.
 *
 * Bildirim türleri:
 * - reminder: çalışma hatırlatması ( напр. "Bugünkü hedefinin yarısını tamamladın" )
 * - exam: deneme zamanı bildirimi
 * - review: tekrar zamanı
 * - weekly_summary: haftalık özet
 * - achievement: başarı / streak
 *
 * Şu an için sadece yapı hazır, gerçek bildirim kodu V2'de eklenecek.
 */

export const NOTIFICATION_TYPES = {
  REMINDER: "reminder",
  EXAM: "exam",
  REVIEW: "review",
  WEEKLY_SUMMARY: "weekly_summary",
  ACHIEVEMENT: "achievement",
};

export function scheduleLocalReminder(message, delayMs = 0) {
  if (typeof window === "undefined") return;
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  setTimeout(() => {
    new Notification("Sınav Koçu", { body: message, icon: "/favicon.ico" });
  }, delayMs);
}

export async function requestNotificationPermission() {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}
