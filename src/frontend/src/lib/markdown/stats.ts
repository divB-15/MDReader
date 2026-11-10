export function countReadingStats(text: string): { words: number; minutes: number } {
  const withoutCode = text.replace(/```[\s\S]*?```/g, ' ').replace(/`[^`]*`/g, ' ')
  const cjk = (withoutCode.match(/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/g) || []).length
  const latin = (
    withoutCode.replace(/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/g, ' ').match(/[A-Za-z0-9]+/g) || []
  ).length
  const words = cjk + latin
  const minutes = Math.max(1, Math.round(cjk / 350 + latin / 180))
  return { words, minutes }
}
