export interface ParsedDate {
  date: string
  afterwards: boolean
}

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

export function deaccent (str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function normalize (str: string): string {
  return deaccent(str.toLowerCase()).replace(/[^a-z]/g, '')
}

export function parseDate (dateStr: string): ParsedDate {
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
