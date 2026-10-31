import { glyphs } from './data/glyphs'
import { galleryById, legacyCollectionIds } from './data/catalogue'

export const COLLECTION_KEY = 'zizai.collection.v1'

export function readCollection(storage: Pick<Storage, 'getItem'> | undefined): string[] {
  try {
    const value: unknown = JSON.parse(storage?.getItem(COLLECTION_KEY) ?? '[]')
    if (!Array.isArray(value)) return []
    const valid = new Set([...glyphs.map(glyph => glyph.char), ...galleryById.keys()])
    return [...new Set(value
      .filter((key): key is string => typeof key === 'string' && valid.has(key))
      .map(key => legacyCollectionIds.get(key) ?? key))]
  } catch {
    return []
  }
}

export function loadCollection(): string[] {
  try { return readCollection(window.localStorage) } catch { return [] }
}

export function storeCollection(collection: string[]): boolean {
  try {
    window.localStorage.setItem(COLLECTION_KEY, JSON.stringify(collection))
    return true
  } catch {
    return false
  }
}
