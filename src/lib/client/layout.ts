export function getRecommendationGridClass(cardCount: number): string {
  if (cardCount <= 1) {
    return "grid grid-cols-1 gap-4";
  }

  if (cardCount >= 3) {
    return "grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3";
  }

  return "grid grid-cols-1 gap-4 md:grid-cols-2";
}

export function getTranscriptBubbleClass(role: "user" | "assistant"): string {
  if (role === "user") {
    return "ml-auto max-w-[92%] rounded-3xl border border-amber-300/30 bg-[linear-gradient(135deg,rgba(187,113,35,0.58),rgba(141,75,18,0.58))] px-4 py-3 text-amber-50 shadow-[0_10px_28px_rgba(0,0,0,0.2)] sm:max-w-[78%]";
  }

  return "mr-auto max-w-[95%] rounded-3xl border border-amber-100/15 bg-[linear-gradient(180deg,rgba(250,244,234,0.98),rgba(241,229,212,0.97))] px-4 py-3 text-stone-900 shadow-[0_14px_36px_rgba(0,0,0,0.28)] sm:max-w-[86%]";
}
