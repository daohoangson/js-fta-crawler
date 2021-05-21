import cheerio from 'cheerio'

import { downloadHtml, getChildren, http, httpCsrf } from './remote'
import { normalize } from './unicode'

export type Direction = 'in' | 'out'

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

const dates = [
  '2019-01-14',
  '2020-01-01',
  '2021-01-01',
  '2022-01-01',
  '2023-01-01',
  '2024-01-01',
  '2025-01-01',
  '2026-01-01',
  '2027-01-01',
  '2028-01-01',
  '2029-01-01',
  '2030-01-01',
  '2031-01-01',
  '2032-01-01',
  '2033-01-01',
  '2034-01-01',
  '2035-01-01',
  '2036-01-01',
  '2037-01-01',
  '2038-01-01',
  '2039-01-01'
]
export const headers = [
  'Mã',
  'Hiệp định',
  'Thuế suất cơ sở',
  'Thuế suất ưu đãi hiện hành',
  'Thuế suất ưu đãi vào cuối lộ trình',
  'Lộ trình',
  ...dates
]

let countries: Array<{ id: number, normalized: string }> | undefined
let found = 0
let parsed = 0

async function collectCountries (): Promise<void> {
  process.stderr.write('Collecting countries...\n')
  const resp = await http('/')
  const html = await resp.text()
  const $ = cheerio.load(html)
  const $options = $('#commodityformsearch-country_id option')

  countries = $options.map((_, e) => {
    const $option = $(e)
    return {
      id: parseInt($option.attr('value') ?? '0'),
      normalized: normalize($option.text())
    }
  }).toArray()
}

async function loop (nodes: Node[], writer: Writer): Promise<void> {
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

function getCountryId (country: string | number): number {
  if (typeof country === 'number') {
    return country
  }

  if (countries !== undefined) {
    const normalized = normalize(country)
    for (const candidate of countries) {
      if (candidate.normalized === normalized) {
        return candidate.id
      }
    }
  }
  return 0
}

async function parse (html: string): Promise<string[]> {
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
  if (chartLabels.length > 1) {
    if (chartLabels.length > dates.length) {
      throw new Error(JSON.stringify({ chartJs, chartLabels, error: 'chartLabels.length > dates.length' }))
    }
    for (let i = 0; i < chartLabels.length; i++) {
      if (chartLabels[i] !== dates[i]) {
        throw new Error(JSON.stringify({ chartJs, chartLabels, i }))
      }
    }

    const chartValues = ((chartJs.match(/"data":\["([0-9",.]+)"\]/) ?? [])[1] ?? '')
      .split('","')
      .map((str) => `${parseFloat(str)}%`)
    if (chartValues.length !== chartLabels.length) {
      throw new Error(JSON.stringify({ chartJs, chartLabels, chartValues }))
    }

    while (chartValues.length < dates.length) {
      chartValues.push('N/A')
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

async function search (dir: Direction, countryId: number): Promise<Node[]> {
  const params = new URLSearchParams()
  httpCsrf(params)
  params.append('commodity', '1')
  params.append('service', '1')
  params.append('CommodityFormSearch[direction]', dir)
  params.append('CommodityFormSearch[country_id]', countryId.toString())
  const body = params.toString()

  process.stderr.write(`Searching direction=${dir} country_id=${countryId}...\n`)
  const resp = await http('/index.php?r=site%2Fsearch-commodity', {
    body,
    headers: {
      'content-type': 'application/x-www-form-urlencoded'
    },
    method: 'POST'
  })

  const html = await resp.text()
  const m = html.match(/"source":(\[.+\])}\);<\/script>/)
  if (m === null) {
    return []
  }

  return JSON.parse(m[1])
}

export async function start (dir: Direction, country: string | number, writer: Writer): Promise<void> {
  if (countries === undefined) {
    await collectCountries()
  }

  const countryId = getCountryId(country)
  const nodes = await search(dir, countryId)
  await loop(nodes, writer)
}
