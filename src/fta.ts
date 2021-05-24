import cheerio from 'cheerio'
import { error, log, progress } from './io'

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

interface ParsedDate {
  date: string
  afterwards: boolean
}

interface ParsedHeader {
  texts: string[]
  dates: string[]
}

interface ParsedValue {
  date: ParsedDate
  value: string
}

export interface Result {
  header: ParsedHeader
  nodes: ParsedNode[]
}

export type Writer = (values: string[]) => Promise<void>

const months: { [key: string]: string | undefined } = {
  mot: '01',
  hai: '02',
  ba: '03',
  bon: '04',
  nam: '05',
  sau: '06',
  bay: '07',
  tam: '08',
  chin: '09',
  muoi: '10',
  muoimot: '11',
  muoihai: '12'
}

let countries: Array<{ id: number, normalized: string }> | undefined

async function collectCountries (): Promise<void> {
  log('Collecting countries...')
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

function parseDate (dateStr: string): ParsedDate {
  const m = dateStr.match(/^(\d+) Tháng (.+) (\d{4})(\s+trở về sau)?$/)
  if (m === null) {
    throw new Error(JSON.stringify({ dateStr }))
  }

  const [, day, monthName, year, afterwards] = m
  const monthNormalized = normalize(monthName)
  const month = months[monthNormalized]
  if (month === undefined) {
    throw new Error(JSON.stringify({ day, month, year, afterwards }))
  }
  return {
    date: `${year}-${month}-${day}`,
    afterwards: typeof afterwards === 'string'
  }
}

async function search (dir: Direction, countryId: number): Promise<Node[]> {
  const params = new URLSearchParams()
  httpCsrf(params)
  params.append('commodity', '1')
  params.append('service', '1')
  params.append('CommodityFormSearch[direction]', dir)
  params.append('CommodityFormSearch[country_id]', countryId.toString())
  const body = params.toString()

  log(`Searching direction=${dir} country_id=${countryId}...`)
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

export async function start (dir: Direction, country: string | number): Promise<Result> {
  if (countries === undefined) {
    await collectCountries()
  }

  const countryId = getCountryId(country)
  const nodes = await search(dir, countryId)
  const obj = new Fta()
  await obj.loop(nodes)

  return {
    header: {
      texts: obj.textHeaders,
      // eslint-disable-next-line
      dates: [...obj.dates].sort()
    },
    nodes: obj.parsed
  }
}

class Fta {
  dates: string[] = []
  found = 0
  parsed: ParsedNode[] = []
  textHeaders: string[] = []

  async loop (nodes: Node[]): Promise<void> {
    for (const node of nodes) {
      if (node.folder) {
        const grandChildren = await getChildren(node)
        if (Array.isArray(grandChildren)) {
          await this.loop(grandChildren)
        }
      } else {
        this.found++

        progress(`[${this.found}] ${node.hscode}...`)
        const html = await downloadHtml(node)
        try {
          this.parsed.push(await this.parseNode(node, html))
        } catch (e) {
          const grandChildren = await getChildren(node)
          if (Array.isArray(grandChildren)) {
            await this.loop(grandChildren)
            continue
          }

          if (e instanceof Error) {
            error(`${node.key} -> error ${e.message}`)
          } else {
            error(`${node.key} -> unknown error`)
          }
        }
      }
    }
  }

  async parseNode (node: Node, html: string): Promise<ParsedNode> {
    const $ = cheerio.load(html)
    const $home = $('#home')
    const $table = $($home.find('table')[0])
    const tds = $table.find('td').map((_, e) => $(e).text()).toArray()
    const ths = $table.find('th').map((_, e) => $(e).text()).toArray()
    if (tds.length !== ths.length) {
      throw new Error(JSON.stringify({ tds, ths }))
    }
    const texts: Record<string, string> = {}
    for (let i = 0; i < ths.length; i++) {
      const header = ths[i]
      texts[header] = tds[i]

      const headerIndex = this.textHeaders.indexOf(header)
      if (headerIndex === -1) {
        this.textHeaders.push(header)
      }
    }

    const values: ParsedValue[] = $home.find('.card-deck tbody tr').map((_, tr) => {
      const deckTds = $(tr).find('td').map((_, td) => $(td).text().trim())
      if (deckTds.length !== 2) {
        throw new Error(JSON.stringify({ deckTds }))
      }
      const date = parseDate(deckTds[0])
      const value = deckTds[1]

      const dateIndex = this.dates.indexOf(date.date)
      if (dateIndex === -1) {
        this.dates.push(date.date)
      }

      return { date, value }
    }).toArray()

    return new ParsedNode(node.hscode, texts, values)
  }
}

export class ParsedNode {
  hscode: string
  texts: Record<string, string>
  values: ParsedValue[]

  constructor (hscode: string, texts: Record<string, string>, values: ParsedValue[]) {
    this.hscode = hscode
    this.texts = texts
    this.values = values
  }

  getValue (date: string): string {
    let afterwardsValue: ParsedValue | undefined
    for (const value of this.values) {
      if (value.date.date === date) {
        return value.value
      }
      if (value.date.afterwards) {
        afterwardsValue = value
      }
    }

    if (afterwardsValue !== undefined && date > afterwardsValue.date.date) {
      return afterwardsValue.value
    }

    return 'N/A'
  }
}
