import fs from 'fs'
import fetch, { RequestInit } from 'node-fetch'

import { Node } from './fta'

const init: RequestInit = {
  headers: {
    cookie: process.env.FTA_COOKIE ?? '',
    'user-agent': process.env.FTA_USER_AGENT ?? ''
  }
}

export async function downloadHtml (node: Node): Promise<string> {
  const url = `https://fta.moit.gov.vn${node.href}`
  const path = `.data/${node.key}-download.html`
  if (fs.existsSync(path)) {
    const cached = fs.readFileSync(path).toString('utf8')
    if (cached.length > 0) {
      return cached
    }
  }

  const req = await fetch(url, init)
  const { status } = req
  if (status !== 200) {
    throw new Error(JSON.stringify({ url, status }))
  }

  const html = await req.text()
  if (html.length > 0) {
    fs.writeFileSync(path, html)
  }

  return html
}

export async function getChildren (node: Node): Promise<any> {
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
