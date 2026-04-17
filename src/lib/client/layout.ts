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
    return "ml-auto max-w-[92%] rounded-[1.4rem] border border-amber-900/25 bg-[linear-gradient(145deg,#c68235_0%,#a86124_100%)] px-4 py-3 text-amber-50 shadow-[0_10px_24px_rgba(84,45,13,0.34)] sm:max-w-[78%]";
  }

  return "mr-auto max-w-[95%] rounded-[1.4rem] border border-amber-900/18 bg-[linear-gradient(180deg,#fffdf8_0%,#f9f0e2_100%)] px-4 py-3 text-stone-900 shadow-[0_12px_32px_rgba(0,0,0,0.2)] sm:max-w-[86%]";
}
