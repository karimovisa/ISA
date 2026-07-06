export type ToastTone = "success" | "error" | "info";

export type ToastDetail = { message: string; tone?: ToastTone };

/** Fire a global toast. Listened for by <Toaster/>. Safe to call anywhere. */
export function toast(message: string, tone: ToastTone = "info") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ToastDetail>("isa:toast", { detail: { message, tone } })
  );
}
