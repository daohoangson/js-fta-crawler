import cheerio from 'cheerio'

import { downloadHtml, getChildren } from './remote'

export interface Node {
  folder: boolean
  href: string
  hscode: string
  key: number
  lvl: number
  sortkey: string
  title: string
}

export type Writer = (values: string[]) => Promise<void>

const dates = ['2019-01-14', '2020-01-01', '2021-01-01', '2022-01-01', '2023-01-01', '2024-01-01', '2025-01-01', '2026-01-01', '2027-01-01', '2028-01-01', '2029-01-01', '2030-01-01', '2031-01-01', '2032-01-01', '2033-01-01', '2034-01-01']
export const headers = [
  'Mã',
  'Hiệp định',
  'Thuế suất cơ sở',
  'Thuế suất ưu đãi hiện hành',
  'Thuế suất ưu đãi vào cuối lộ trình',
  'Lộ trình',
  ...dates
]

let found = 0
let parsed = 0

export async function loop (nodes: Node[], writer: Writer): Promise<void> {
  for (const node of nodes) {
    // edge cases: key=9697 hscode=03061701 has two children
    if (node.folder || node.key === 9697) {
      const grandChildren = await getChildren(node)
      if (Array.isArray(grandChildren)) {
        await loop(grandChildren, writer)
      }
    } else {
      found++

      if (parsed % 25 === 0) {
        process.stderr.write(` (${parsed} / ${found}) `)
      } else {
        process.stderr.write('.')
      }
      const html = await downloadHtml(node)
      try {
        const values = await parse(html)
        parsed++
        await writer([node.hscode, ...values])
      } catch (e) {
        if (e instanceof Error) {
          process.stderr.write(`${node.key} -> ${e.message}`)
        } else {
          process.stderr.write(`${node.key} -> unknown error`)
        }
      }
    }
  }
}

export async function parse (html: string): Promise<string[]> {
  const $ = cheerio.load(html)
  const $home = $('#home')
  const $table = $($home.find('table')[0])
  const $tds = $table.find('td')
  const texts = $tds.toArray().map((e) => $(e).text())
  if (texts.length !== 5) {
    throw new Error(JSON.stringify({ texts }))
  }

  const chartJs = (html.match(/var chartJS_graph0 = new Chart\(\$\('#graph0'\),(.+)/) ?? [])[1] ?? ''
  const chartLabels = ((chartJs.match(/"labels":\["([0-9",-]+)"\]/) ?? [])[1] ?? '').split('","')
  if (chartLabels.length === dates.length) {
    if (chartLabels.join(',') !== dates.join(',')) {
      throw new Error(JSON.stringify({ chartJs, chartLabels }))
    }

    const chartValues = ((chartJs.match(/"data":\["([0-9",.]+)"\]/) ?? [])[1] ?? '')
      .split('","')
      .map((str) => `${parseFloat(str)}%`)
    if (chartValues.length !== dates.length) {
      throw new Error(JSON.stringify({ chartJs, chartValues }))
    }

    return [...texts, ...chartValues]
  }

  // no chart, extract values from table
  const tableValues = $home.find('.card-deck tbody tr').map((_, tr) => {
    const td = $(tr).find('td')[1]
    return $(td).text().trim()
  }).toArray()

  while (tableValues.length < dates.length) {
    tableValues.push('N/A')
  }

  return [...texts, ...tableValues]
}
