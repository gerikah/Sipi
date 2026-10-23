// Presentation only: retain every source word and punctuation mark. Blank lines
// mark paragraphs; single export line wraps flow naturally at the reader's width.
export function abstractParagraphs(text: string): string[] {
  return text.replace(/\r\n?/g, '\n')
    .split(/\n[ \t]*\n+|\n(?=[ \t]*(?:key\s*words?|key\s*terms?|index\s*terms?)\b[ \t]*(?:[:\-\u2013\u2014]|\n))/i)
    .map(paragraph => paragraph.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}
