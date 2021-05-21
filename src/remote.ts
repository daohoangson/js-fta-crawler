import cheerio from 'cheerio'
import fs from 'fs'
import fetchCookie from 'fetch-cookie'
import nodeFetch, { RequestInit, Response } from 'node-fetch'
import toughCookie from 'tough-cookie'

import { Node } from './fta'

const jar = new toughCookie.CookieJar()
const fetch = fetchCookie(nodeFetch, jar)

let csrfParam: string | undefined
let csrfToken: string | undefined

export async function downloadHtml (node: Node): Promise<string> {
  const cachePath = `.data/${node.key}-download.html`
  if (fs.existsSync(cachePath)) {
    const cached = fs.readFileSync(cachePath).toString('utf8')
    if (cached.length > 0) {
      return cached
    }
  }

  const resp = await http(node.href)
  const { status } = resp
  if (status !== 200) {
    throw new Error(JSON.stringify({ status }))
  }

  const html = await resp.text()
  if (html.length > 0) {
    fs.writeFileSync(cachePath, html)
  }

  return html
}

export async function getChildren (node: Node): Promise<any> {
  const path = `.data/${node.key}-getChildren.json`
  if (fs.existsSync(path)) {
    const cached = JSON.parse(fs.readFileSync(path).toString('utf8'))
    if (Array.isArray(cached)) {
      return cached
    }
  }

  const resp = await http(`/index.php?r=site/get-children2&id=${node.key}&sortkey=${node.sortkey}&lvl=${node.lvl}&mode=children&parent=${node.key}`)
  const json = await resp.json()
  if (Array.isArray(json)) {
    fs.writeFileSync(path, JSON.stringify(json))
  }

  return json
}

export async function http (path: string, init?: RequestInit): Promise<Response> {
  const resp = await fetch(`https://fta.moit.gov.vn${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36'
    }
  })

  const _text = resp.text
  resp.text = async () => {
    const html = await _text.call(resp)
    const $ = cheerio.load(html)
    csrfParam = $('meta[name=csrf-param]').attr('content')
    csrfToken = $('meta[name=csrf-token]').attr('content')

    return html
  }

  return resp
}

export function httpCsrf (params: URLSearchParams): void {
  if (csrfParam === undefined) return
  if (csrfToken === undefined) return

  params.append(csrfParam, csrfToken)
}
