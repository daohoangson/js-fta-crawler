export function deaccent (str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function normalize (str: string): string {
  return deaccent(str.toLowerCase()).replace(/[^a-z]/g, '')
}
