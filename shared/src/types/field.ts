export interface SourceReference { doc: string | null; page: number | null; snippet: string | null }
export type FieldStatus = 'extracted' | 'inferred' | 'missing';
export type ExtractedField<T> =
  | { value: T; status: 'extracted' | 'inferred'; source: SourceReference; confidence: number }
  | { value: null; status: 'missing'; source: SourceReference; confidence: 0 };
export function missingField<T>(): ExtractedField<T> {
  return { value: null, status: 'missing', source: { doc: null, page: null, snippet: null }, confidence: 0 };
}
export function createExtractedField<T>(value: T | null | undefined, status: FieldStatus,
  source: SourceReference, confidence: number): ExtractedField<T> {
  if (value == null || status === 'missing') return missingField<T>();
  return { value, status, source, confidence };
}
