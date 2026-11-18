/**
 * Filme da abertura (ou de qualquer trecho): grava os quadros que o compositor produz
 * (screencast do Chrome) e monta uma tira com N quadros recortados. É assim que se confere
 * animação: o page.screenshot() desta página devolve quadro velho das camadas animadas na
 * GPU (o cometa e a respiração da esfera "não existiam" no print e estavam na tela).
 *
 * Uso: node scripts/filme.mjs [--de 1.8] [--ate 3.1] [--quadros 8] [--recorte x,y,w,h]
 *                             [--largura 1440] [--rolar 0] [--saida .tmp/filme.png]
 */
import puppeteer from 'puppeteer-core'
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

const opt = (n, d) => { const i = process.argv.indexOf('--' + n); return i > -1 ? process.argv[i + 1] : d }
const de = Number(opt('de', 1.8)), ate = Number(opt('ate', 3.1)), n = Number(opt('quadros', 8))
const largura = Number(opt('largura', 1440)), rolar = Number(opt('rolar', 0))
const [x, y, w, h] = String(opt('recorte', `0,0,${largura},768`)).split(',').map(Number)
const saida = opt('saida', '.tmp/filme.png')
mkdirSync(path.dirname(saida), { recursive: true })

const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--enable-gpu', '--use-angle=d3d11', '--hide-scrollbars'] })
const p = await b.newPage()
await p.setViewport({ width: largura, height: 900 })
const cdp = await p.createCDPSession()
const quadros = []
cdp.on('Page.screencastFrame', async (f) => {
  quadros.push({ t: f.metadata.timestamp, data: f.data })
  await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {})
})
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, everyNthFrame: 1 })
const inicio = Date.now() / 1000
await p.goto(process.env.BASE_URL ?? 'http://localhost:3412/', { waitUntil: 'domcontentloaded' })
if (rolar) { await new Promise((r) => setTimeout(r, Number(opt('antes', 300)) * 1)); await p.evaluate((y) => scrollTo({ top: y, behavior: 'instant' }), rolar) }
await new Promise((r) => setTimeout(r, (ate + 0.4) * 1000))
await cdp.send('Page.stopScreencast')
await b.close()

const janela = quadros.map((q) => ({ ...q, s: q.t - inicio })).filter((q) => q.s >= de && q.s <= ate)
const passo = Math.max(1, Math.floor(janela.length / n))
const escolhidos = janela.filter((_, i) => i % passo === 0).slice(0, n)
const partes = await Promise.all(escolhidos.map(async (q) => {
  const img = await sharp(Buffer.from(q.data, 'base64')).extract({ left: x, top: y, width: w, height: h }).toBuffer()
  const rot = Buffer.from(`<svg width="160" height="34"><rect width="160" height="34" fill="#000" opacity=".55"/><text x="8" y="24" font-size="20" fill="#fff" font-family="Arial">${q.s.toFixed(2)} s</text></svg>`)
  return sharp(img).composite([{ input: rot, top: 0, left: 0 }]).png().toBuffer()
}))
await sharp({ create: { width: w, height: h * partes.length, channels: 3, background: '#000' } })
  .composite(partes.map((input, i) => ({ input, top: i * h, left: 0 })))
  .png().toFile(saida)
console.log(`${quadros.length} quadros gravados, ${partes.length} na tira → ${saida}`)
