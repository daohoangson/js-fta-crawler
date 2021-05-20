import cheerio from 'cheerio'
import { createArrayCsvWriter } from 'csv-writer'
import fs from 'fs'
import fetch, { RequestInit } from 'node-fetch'

const init: RequestInit = {
  headers: {
    cookie: process.env.FTA_COOKIE ?? '',
    'user-agent': process.env.FTA_USER_AGENT ?? ''
  }
}

const expectedLabels = ["2019-01-14", "2020-01-01", "2021-01-01", "2022-01-01", "2023-01-01", "2024-01-01", "2025-01-01", "2026-01-01", "2027-01-01", "2028-01-01", "2029-01-01", "2030-01-01", "2031-01-01", "2032-01-01", "2033-01-01", "2034-01-01"]
const writer = createArrayCsvWriter({
  path: 'result.csv',
  header: [
    'Mã',
    'Hiệp định',
    'Thuế suất cơ sở',
    'Thuế suất ưu đãi hiện hành',
    'Thuế suất ưu đãi vào cuối lộ trình',
    'Lộ trình',
    ...expectedLabels
  ]
})

let found = 0
let parsed = 0

async function getChildren(node: any): Promise<any> {
  const url = `https://fta.moit.gov.vn/index.php?r=site/get-children2&id=${node.key}&sortkey=${node.sortkey}&lvl=${node.lvl}&mode=children&parent=${node.key}`
  const path = `.data/${node.key}-getChildren.json`
  if (fs.existsSync(path)) {
    const cached = JSON.parse(fs.readFileSync(path).toString('utf8'))
    if (Array.isArray(cached)) {
      return cached
    }
  }

  const req = await fetch(url, init)
  const json = await req.json()
  if (Array.isArray(json)) {
    fs.writeFileSync(path, JSON.stringify(json))
  }

  return json
}

async function downloadHtml(node: any): Promise<string> {
  const url = `https://fta.moit.gov.vn${node.href}`
  const path = `.data/${node.key}-download.html`
  if (fs.existsSync(path)) {
    const cached = fs.readFileSync(path).toString('utf8')
    if (cached.length > 0) {
      return cached
    }
  }

  const req = await fetch(url, init)
  if (req.status !== 200) {
    console.error('status', node.key, req.status)
    return ''
  }

  const html = await req.text()
  if (html.length > 0) {
    fs.writeFileSync(path, html)
  }

  return html
}

async function parse(node: any, html: string): Promise<boolean> {
  const $ = cheerio.load(html)
  const $home = $('#home')
  const $table = $($home.find('table')[0])
  const $tds = $table.find('td')
  const texts = $tds.length === 5 ?
    $tds.toArray().map((e) => $(e).text()) :
    ['N/A', 'N/A', 'N/A', 'N/A', 'N/A']
  let data: string[]

  const js0 = (html.match(/var chartJS_graph0 = new Chart\(\$\('#graph0'\),(.+)/) ?? [])[1] ?? ''
  const labels = ((js0.match(/"labels":\["([0-9",-]+)"\]/) ?? [])[1] ?? '').split('","')
  if (labels.length === expectedLabels.length) {
    if (labels.join(',') !== expectedLabels.join(',')) {
      console.error('labels', node.key, labels)
      return false
    }

    data = ((js0.match(/"data":\["([0-9",\.]+)"\]/) ?? [])[1] ?? '').split('","').map((str) => `${parseFloat(str)}%`)
    if (data.length !== expectedLabels.length) {
      console.error('chart data', node.key, data)
      return false
    }
  } else {
    // no chart, extract data from table
    data = $home.find('.card-deck tbody tr').map((_, tr) => {
      const td = $(tr).find('td')[1]
      return $(td).text().trim()
    }).toArray()

    while (data.length < expectedLabels.length) {
      data.push('N/A')
    }
  }

  await writer.writeRecords([[node.title, ...texts, ...data]])
  return true
}

async function loop(children: any[]) {
  for (const node of children) {
    if (node.folder === true) {
      // console.log('Processing... #%d (lvl=%d)', node.key, node.lvl)
      const grandChildren = await getChildren(node);
      if (Array.isArray(grandChildren)) {
        await loop(grandChildren)
      }
    } else {
      found++

      // console.log('%s... #%d found=%d parsed=%d', node.title, node.key, found, parsed)
      if (parsed % 25 === 0) {
        process.stdout.write(` (${parsed} / ${found}) `)
      } else {
        process.stdout.write('.')
      }
      const html = await downloadHtml(node);
      const ok = await parse(node, html);
      if (ok) {
        parsed++
      }
    }
  }
}

const source = require('./source.json');
loop(source)

