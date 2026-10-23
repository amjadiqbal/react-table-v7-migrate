// Deterministic stand-in for the v7 examples' makeData (which used namor + Math.random).
// Names mix case and digits so v7's case-sensitive alphanumeric sort is exercised.
const WORDS = ['alpha', 'Bravo', 'charlie9', 'delta10', 'Echo2', 'foxtrot', 'Golf', 'hotel1', 'india', 'Juliet',
  'kilo20', 'lima3', 'Mike', 'november', 'oscar11', 'Papa', 'quebec', 'romeo4', 'Sierra', 'tango100']

function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export default function makeData(...lens) {
  const random = rng(42)
  const pick = () => WORDS[Math.floor(random() * WORDS.length)]
  const newPerson = () => {
    const statusChance = random()
    return {
      firstName: pick(),
      lastName: pick(),
      age: Math.floor(random() * 30),
      visits: Math.floor(random() * 100),
      progress: Math.floor(random() * 100),
      status: statusChance > 0.66 ? 'relationship' : statusChance > 0.33 ? 'complicated' : 'single',
    }
  }
  const level = (depth = 0) =>
    Array.from({ length: lens[depth] }, () => ({
      ...newPerson(),
      subRows: lens[depth + 1] ? level(depth + 1) : undefined,
    }))
  return level()
}
