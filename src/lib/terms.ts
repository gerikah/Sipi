export type SourceTerm = { key: string; label: string; kind: 'keyword' | 'technology' }
export const termKey = (value: string) => value.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase('en')
type SourceText = { title: string; abstract: string | null }
const analysisText = (record: SourceText) => `${record.title}\n${record.abstract || ''}`.replace(/\bphp\s*[\d,.]+|[\d,.]+\s*php\b/gi, '')
const technologies: [string, RegExp][] = [
  ['Arduino', /\barduino(?:mega)?\b/i], ['Raspberry Pi', /\braspberry\s+pi\b/i], ['Android', /\bandroid\b/i],
  ['Bluetooth', /\bbluetooth\b/i], ['GSM', /\bgsm\b/i], ['RFID', /\brfid\b/i], ['GPS', /\bgps\b/i], ['Wi-Fi', /\bwi[ -]?fi\b/i],
  ['PHP', /\bphp\b/i], ['Python', /\bpython\b/i], ['JavaScript', /\bjavascript\b/i], ['MySQL', /\bmysql\b/i],
  ['OpenCV', /\bopencv\b/i], ['MATLAB', /\bmatlab\b/i], ['TensorFlow', /\btensorflow\b/i], ['ESP32', /\besp32\b/i],
  ['ESP8266', /\besp8266\b/i], ['NodeMCU', /\bnodemcu\b/i], ['DHT11', /\bdht11\b/i], ['DHT22', /\bdht22\b/i],
  ['Zigbee', /\bzigbee\b/i], ['LoRa', /\blora\b/i], ['Google Maps API', /\bgoogle\s+maps\s+api\b/i],
]
export function sourceTerms(record: SourceText): SourceTerm[] {
  const terms = new Map<string, SourceTerm>(), abstract = record.abstract || ''
  for (const match of abstract.matchAll(/\b(?:key\s*words?|index\s*terms?)\s*(?:[:\-–—]|\r?\n)\s*/gi)) {
    const tail = abstract.slice(match.index + match[0].length).split(/\r?\n\s*\r?\n|(?:\r?\n|\s)(?:references|acknowledg(?:e)?ments|conclusion|keywords|index terms)\s*[:–—]/i)[0].trim().replace(/[.]+$/, '').trim().replace(/^\((.*)\)$/s, '$1')
    for (const raw of tail.split(/[,;]/)) {
      const label = raw.replace(/\s+/g, ' ').trim().replace(/^and\s+/i, '').replace(/[.]+$/, '').trim()
      if (!label || label.length > 240 || /[.!?]\s+[A-Z]/.test(label)) continue
      const key = `keyword:${termKey(label)}`; terms.set(key, { key, label, kind: 'keyword' })
    }
  }
  for (const [label, pattern] of technologies) if (pattern.test(analysisText(record))) {
    const key = `technology:${termKey(label)}`; terms.set(key, { key, label, kind: 'technology' })
  }
  return [...terms.values()]
}
export function termOptions(records: SourceText[]) {
  const options = new Map<string, SourceTerm & { count: number }>()
  for (const record of records) for (const term of sourceTerms(record)) {
    const existing = options.get(term.key)
    if (existing) existing.count++; else options.set(term.key, { ...term, count: 1 })
  }
  return [...options.values()].sort((a, b) => a.label.localeCompare(b.label, 'en'))
}
export function matchesTerms(record: SourceText, keyword: string, technology: string) {
  const keys = new Set(sourceTerms(record).map(term => term.key))
  return (!keyword || keys.has(keyword)) && (!technology || keys.has(technology))
}
export function recordCategory(record: SourceText) {
  const text = analysisText(record)
  const hardware = [...text.matchAll(/\b(?:arduino(?:mega)?|raspberry\s+pi|microcontrollers?|sensors?|motors?|actuators?|circuits?|robot(?:s|ic)?|robotics|pumps?|embedded\s+systems?|electronic\s+devices?|gsm\s+modules?|rfid|radio\s+frequency\s+identification|esp32|esp8266|nodemcu|dht11|dht22|machines?(?![-\s]+(?:learning|vision))|device(?![-\s]+independent)|generators?|turbines?|quadcopters?|ovens?|heaters?|grinders?|compactors?|chargers?|light[-\s]+emitting\s+diodes?|thermoelectric|photovoltaic|wireless\s+controllers?|cameras?|incubators?|wheelchairs?|printers?)\b/gi)]
    .filter(match => match[0].toLowerCase() !== 'device' || !/\b(?:android|mobile|software)\s*$/i.test(text.slice(0, match.index)))
  const software = [...text.matchAll(/\b(?:software|(?:mobile|android|web|desktop)\s+(?:applications?|apps?)|android|web[-\s]+based|websites?|web\s+servers?|databases?|computer\s+vision|machine\s+(?:learning|vision)|neural\s+networks?|image\s+processing|data\s+analytics|php|python|javascript|mysql|opencv|tensorflow|(?:learning\s+management|enterprise\s+management|decision\s+support)\s+systems?)\b/gi)]
  const evidence = (matches: RegExpMatchArray[]) => [...new Set(matches.map(match => termKey(match[0])))]
  return { key: hardware.length && software.length ? 'both' : hardware.length ? 'hardware' : software.length ? 'software' : 'unclassified',
    label: hardware.length && software.length ? 'Hardware + Software' : hardware.length ? 'Hardware' : software.length ? 'Software' : 'Not classified',
    hardware: evidence(hardware), software: evidence(software) }
}
export function matchesCategory(record: SourceText, category: string) {
  const found = recordCategory(record).key
  return !category || found === category || (found === 'both' && ['hardware', 'software'].includes(category))
}
