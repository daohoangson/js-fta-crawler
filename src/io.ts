export function error (str: string): boolean {
  const { stderr: stream } = process
  return stream.write(`\n${str}\n`)
}

export function log (str: string): boolean {
  const { stdout: stream } = process
  return stream.write(`\n${str}\n`)
}

export function progress (str: string): boolean {
  const { stdout: stream } = process
  if (typeof stream.cursorTo === 'function') {
    stream.cursorTo(0)
  }

  return stream.write(`${str}`)
}
