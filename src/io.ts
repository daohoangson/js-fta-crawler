import { createArrayCsvWriter } from 'csv-writer'

import { Direction, Result } from './fta'

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

export async function write (dir: Direction, country: string | number, result: Result): Promise<void> {
  const path = `${country}-${dir}.csv`
  const { header, nodes } = result

  log(`Writing to ${path}...`)
  const csv = createArrayCsvWriter({
    path,
    header: ['Mã', ...header.texts, ...header.dates]
  })

  for (const node of nodes) {
    const record = [
      node.hscode,
      ...header.texts.map((header) => node.texts[header] ?? 'N/A')
    ]

    for (const date of header.dates) {
      record.push(node.getValue(date))
    }

    await csv.writeRecords([record])
  }
}
