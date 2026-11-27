/**
 * Build do site da Eletron Paulista (base do 08-inter, que veio do 02-nubank). HTML, CSS e JS estático em dist/
 * (base do 02-nubank, que veio do 01-g4 e do 079). Os títulos com data-palavras saem
 * quebrados em letras aqui (scripts/letras.mjs, kit da skill /animacoes-site).
 *
 *   node build.mjs                            página inteira em dist/index.html
 *   node build.mjs --preview 03-ecossistema   só aquela seção, em dist/preview/03-ecossistema.html
 *   node build.mjs --preview 00-header,01-hero
 *   node build.mjs --publicar                 página inteira do zero, sem os previews (antes de subir)
 *
 * Como funciona:
 * - src/index.html é o molde. <!-- @parcial NOME --> puxa src/partials/NOME.html.
 * - CSS: src/css/_*.css primeiro (fontes e base), depois o arquivo de cada seção, com o
 *   mesmo nome do parcial, em ordem de nome, e 99-*.css por último. Entra minificado num
 *   <style>. No preview entram só os arquivos das seções pedidas (e os _ e 99-).
 * - JS: mesma regra, em src/js, num <script> no fim do <body>. Cada arquivo é um IIFE.
 * - {{cfg.caminho}} puxa qualquer valor do site.config.json; {{ano}} é o ano atual.
 * - <i data-i="nome" data-w="light" class="..."></i> vira <svg><use> apontando pro
 *   sprite de ícones (Phosphor, node_modules/@phosphor-icons/core), montado só com os
 *   ícones usados. Pesos: thin, light, regular, bold, fill, duotone. O peso "marca" pega o
 *   desenho próprio em src/svg/<nome>.svg (o "nu" do Nubank, o HBO Max), com o viewBox dele.
 * - <img data-img="nome" sizes="..." alt="..."> vira <picture> com AVIF e WebP em srcset,
 *   width e height, a partir de src/assets/img/manifesto.json (npm run imagens).
 *   data-img-max="960" limita o src de reserva. data-picture="classe" põe classe no <picture>.
 *   data-preload (na imagem do LCP) gera o <link rel="preload"> no topo do <head>, com o
 *   mesmo srcset e sizes do AVIF e fetchpriority alto (memória do 080).
 *   Direção de arte: data-img-movel="outro-nome" data-movel-media="(max-width: 40em)"
 *   data-movel-sizes="107vw" põe antes as <source media> com outra imagem (um recorte) pra
 *   essa faixa, com width e height do recorte; com data-preload saem dois preloads com media.
 * - <!-- @schema --> recebe o JSON-LD.
 * - Avisa: travessão no texto, img sem alt/width/height, id repetido, âncora sem
 *   destino, marcador {{...}} que sobrou, CSS com chave desbalanceada e mais de um h1.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, statSync, copyFileSync, renameSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as cheerio from 'cheerio'
import { letras } from './scripts/letras.mjs'

const RAIZ = path.dirname(fileURLToPath(import.meta.url))
const P = (...a) => path.join(RAIZ, ...a)
const DIST = P('dist')
const cfg = JSON.parse(readFileSync(P('site.config.json'), 'utf8'))
const manifesto = existsSync(P('src/assets/img/manifesto.json')) ? JSON.parse(readFileSync(P('src/assets/img/manifesto.json'), 'utf8')) : {}
const avisos = []
const PRIMEIRO = '00-header'
const ULTIMO = '99-rodape'

const argPreview = (() => {
  const i = process.argv.indexOf('--preview')
  return i > -1 ? process.argv[i + 1].split(',').map((s) => s.trim()) : null
})()

// ---------------------------------------------------------------- utilidades
// gravação atômica: vários agentes rodam o build de preview ao mesmo tempo
function gravar(arq, conteudo) {
  mkdirSync(path.dirname(arq), { recursive: true })
  const tmp = `${arq}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`
  writeFileSync(tmp, conteudo)
  for (let t = 0; t < 20; t++) {
    try {
      renameSync(tmp, arq)
      return
    } catch (e) {
      if (t === 19) throw e
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50)
    }
  }
}

function copiarPasta(de, para) {
  if (!existsSync(de)) return
  mkdirSync(para, { recursive: true })
  for (const nome of readdirSync(de)) {
    if (nome.startsWith('.') || nome === 'manifesto.json') continue
    const a = path.join(de, nome)
    const b = path.join(para, nome)
    const st = statSync(a)
    if (st.isDirectory()) copiarPasta(a, b)
    else if (!existsSync(b) || statSync(b).size !== st.size || statSync(b).mtimeMs < st.mtimeMs) {
      try {
        copyFileSync(a, b)
      } catch {
        /* outro processo copiando o mesmo arquivo: ignora */
      }
    }
  }
}

function lerParcial(nome) {
  const arq = P('src/partials', `${nome}.html`)
  if (!existsSync(arq)) {
    avisos.push(`parcial ausente: ${nome}`)
    return `<!-- parcial ${nome} ainda não existe -->`
  }
  return readFileSync(arq, 'utf8')
}

function arquivos(pasta, ext, so = null) {
  if (!existsSync(P(pasta))) return []
  const todos = readdirSync(P(pasta)).filter((f) => f.endsWith(ext))
  const base = todos.filter((f) => f.startsWith('_')).sort()
  const resto = todos.filter((f) => !f.startsWith('_')).sort().filter((f) => !so || so.includes(f.replace(ext, '')) || f.startsWith('99-'))
  return [...base, ...resto]
}

function juntar(pasta, ext, so) {
  return arquivos(pasta, ext, so)
    .map((f) => {
      const c = readFileSync(P(pasta, f), 'utf8')
      if (ext === '.css') {
        const abre = (c.match(/{/g) || []).length
        const fecha = (c.match(/}/g) || []).length
        if (abre !== fecha) avisos.push(`CSS com chaves desbalanceadas: ${f} (${abre} abre, ${fecha} fecha)`)
      }
      return c
    })
    .join(ext === '.js' ? '\n;\n' : '\n')
}

// Minificação conservadora: só comentário e espaço redundante. Não mexe em espaço
// perto de ":" ou ">", que muda o sentido de seletor (".a :is(.b)").
function minCss(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{};])\s*/g, '$1')
    .replace(/,\s+/g, ',')
    .replace(/;}/g, '}')
    .trim()
}

function minJs(js) {
  // só tira comentário de linha inteira e linhas em branco; o JS é pequeno
  return js
    .split('\n')
    .filter((l) => !/^\s*\/\//.test(l))
    .map((l) => l.trim())
    .filter((l) => l !== '')
    .join('\n')
}

function valor(caminho, avisar = true) {
  const v = caminho.split('.').reduce((o, k) => (o == null ? undefined : o[k]), cfg)
  if (v === undefined && avisar) avisos.push(`config sem o caminho: ${caminho}`)
  return v ?? ''
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// ---------------------------------------------------------------- ícones (sprite com <use>)
const usados = new Map()
function icone(nome, peso = 'light', classe = '') {
  const id = `i-${nome}-${peso}`
  if (!usados.has(id)) {
    const marca = peso === 'marca'
    const arq = marca ? P('src/svg', `${nome}.svg`) : P('node_modules/@phosphor-icons/core/assets', peso, `${nome}${peso === 'regular' ? '' : '-' + peso}.svg`)
    if (!existsSync(arq)) {
      avisos.push(`ícone não existe: ${nome} (${peso})`)
      return ''
    }
    const svg = readFileSync(arq, 'utf8')
    const caixa = marca ? (svg.match(/viewBox="([^"]+)"/) || [])[1] || '0 0 256 256' : '0 0 256 256'
    const miolo = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/\s+/g, ' ').trim()
    usados.set(id, `<symbol id="${id}" viewBox="${caixa}">${miolo}</symbol>`)
  }
  const cls = ['i', classe].filter(Boolean).join(' ')
  return `<svg class="${cls}" aria-hidden="true" focusable="false"><use href="#${id}"/></svg>`
}

// ---------------------------------------------------------------- imagens (<picture> com AVIF e WebP)
function versoes(nome, ext) {
  return Object.entries(manifesto)
    .map(([arq, m]) => ({ arq, m, w: Number((arq.match(new RegExp(`^${nome}-(\\d+)\\.${ext}$`)) || [])[1]) }))
    .filter((v) => v.w)
    .sort((a, b) => a.w - b.w)
}
const srcset = (vs) => vs.map((v) => `/assets/img/${v.arq} ${v.m.w}w`).join(', ')
const attr = (s, nome) => (s.match(new RegExp(`\\s${nome}="([^"]*)"`)) || [])[1]
const temAttr = (s, nome) => new RegExp(`\\s${nome}(\\s|=|$)`).test(s)
const semAttr = (s, ...nomes) => nomes.reduce((t, n) => t.replace(new RegExp(`\\s${n}(="[^"]*")?(?=[\\s>/]|$)`, 'g'), ''), s)
const preloads = []

function imagens(html) {
  return html.replace(/<img\b([^>]*?)\sdata-img="([\w-]+)"([^>]*)>/g, (tag, antes, nome, depois) => {
    let attrs = antes + depois
    const sizes = attr(attrs, 'sizes') || '100vw'
    const max = Number(attr(attrs, 'data-img-max') || Infinity)
    const classePicture = attr(attrs, 'data-picture')
    const preload = temAttr(attrs, 'data-preload')
    const movel = attr(attrs, 'data-img-movel')
    const movelMedia = attr(attrs, 'data-movel-media')
    const movelSizes = attr(attrs, 'data-movel-sizes') || '100vw'
    attrs = semAttr(attrs, 'data-img-max', 'data-picture', 'data-preload', 'sizes', 'data-img-movel', 'data-movel-media', 'data-movel-sizes')
    const vw = versoes(nome, 'webp')
    const va = versoes(nome, 'avif')
    if (!vw.length) {
      avisos.push(`data-img sem arquivo no manifesto: ${nome}`)
      return tag
    }
    const fontes = []
    const mvw = movel ? versoes(movel, 'webp') : []
    const mva = movel ? versoes(movel, 'avif') : []
    if (movel && !mvw.length) avisos.push(`data-img-movel sem arquivo no manifesto: ${movel}`)
    if (mvw.length) {
      const maior = mvw[mvw.length - 1].m
      const dims = ` width="${maior.w}" height="${maior.h}"`
      if (mva.length) fontes.push(`<source type="image/avif" media="${movelMedia}" srcset="${srcset(mva)}" sizes="${movelSizes}"${dims}>`)
      fontes.push(`<source type="image/webp" media="${movelMedia}" srcset="${srcset(mvw)}" sizes="${movelSizes}"${dims}>`)
    }
    if (va.length) fontes.push(`<source type="image/avif" srcset="${srcset(va)}" sizes="${sizes}">`)
    const principal = [...vw].reverse().find((v) => v.w <= max) || vw[0]
    const img = `<img src="/assets/img/${principal.arq}" srcset="${srcset(vw)}" sizes="${sizes}" width="${principal.m.w}" height="${principal.m.h}"${attrs}>`
    if (preload) {
      const lista = va.length ? va : vw
      const fora = mvw.length ? ` media="not all and ${movelMedia}"` : ''
      preloads.push(`<link rel="preload" as="image" type="image/${va.length ? 'avif' : 'webp'}" imagesrcset="${srcset(lista)}" imagesizes="${sizes}"${fora} fetchpriority="high">`)
      if (mvw.length) {
        const ml = mva.length ? mva : mvw
        preloads.push(`<link rel="preload" as="image" type="image/${mva.length ? 'avif' : 'webp'}" imagesrcset="${srcset(ml)}" imagesizes="${movelSizes}" media="${movelMedia}" fetchpriority="high">`)
      }
    }
    return `<picture${classePicture ? ` class="${classePicture}"` : ''}>${fontes.join('')}${img}</picture>`
  })
}

// ---------------------------------------------------------------- dados estruturados
// As perguntas do FAQPage saem do próprio HTML da seção 08 (o <details> de cada pergunta):
// o texto fica num lugar só.
function schema(html) {
  const base = (cfg.dominio || '').replace(/\/$/, '')
  const org = {
    '@type': 'EducationalOrganization',
    '@id': base ? `${base}/#eletron` : '#eletron',
    name: 'Eletron Paulista',
    foundingDate: '2008',
    telephone: '+55-77-3639-0197',
    email: 'contato@eletronpaulista.com.br',
    address: { '@type': 'PostalAddress', streetAddress: 'R. Juscelino Kubitschek, 66, Jardim Paraíso', addressLocality: 'Luís Eduardo Magalhães', addressRegion: 'BA', addressCountry: 'BR' },
    sameAs: Object.values(cfg.redes || {}),
  }
  if (base) org.url = `${base}/`
  return `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': [org] })}</script>`
}

// ---------------------------------------------------------------- montagem
function montar(parciais) {
  let html = readFileSync(P('src/index.html'), 'utf8')
  if (parciais) {
    // preview: só o(s) parcial(is) pedido(s); header e rodapé ficam fora do <main>
    const header = parciais.includes(PRIMEIRO) ? `<!-- @parcial ${PRIMEIRO} -->` : ''
    const rodape = parciais.includes(ULTIMO) ? `<!-- @parcial ${ULTIMO} -->` : ''
    const meio = parciais
      .filter((n) => n !== PRIMEIRO && n !== ULTIMO)
      .map((n) => `<!-- @parcial ${n} -->`)
      .join('\n')
    html = html.replace(new RegExp(`<!--\\s*@parcial ${PRIMEIRO}\\s*-->[\\s\\S]*<!--\\s*@parcial ${ULTIMO}\\s*-->`), `${header}\n  <main id="conteudo">\n${meio}\n  </main>\n${rodape}`)
  }
  for (let n = 0; n < 4 && /<!--\s*@parcial\s/.test(html); n++) html = html.replace(/<!--\s*@parcial\s+([\w-]+)\s*-->/g, (_, nome) => lerParcial(nome))
  const cabeca = []
  html = html.replace(/<!--\s*@head\s*-->([\s\S]*?)<!--\s*\/@head\s*-->/g, (_, c) => {
    cabeca.push(c.trim())
    return ''
  })
  html = html.replace('<!-- @head-parciais -->', cabeca.join('\n  '))
  html = html.replace('<!-- @js -->', () => `<script>${minJs(juntar('src/js', '.js', parciais))}</script>`)
  html = html.replace('<!-- @css -->', () => `<style>${minCss(juntar('src/css', '.css', parciais))}</style>`)
  html = html.replace(/<i data-i="([\w-]+)"(?: data-w="(\w+)")?(?: class="([^"]*)")?><\/i>/g, (_, nome, peso, classe) => icone(nome, peso || 'light', classe || ''))
  html = html.replace(/\{\{cfg\.([\w.]+)\}\}/g, (_, c) => esc(valor(c)))
  html = html.replace(/\{\{ano\}\}/g, String(new Date().getFullYear()))
  html = html.replace('<!-- @schema -->', () => schema(html))
  html = letras(html)
  html = imagens(html)
  html = html.replace('<!-- @preload -->', () => preloads.join('\n  '))
  html = html.replace('<!-- @sprite -->', () => `<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" width="0" height="0" style="position:absolute;overflow:hidden">${[...usados.values()].join('')}</svg>`)
  html = html.replace('<!-- @robots -->', cfg.indexar ? '<meta name="robots" content="index, follow, max-image-preview:large">' : '<meta name="robots" content="noindex, nofollow">')
  const base = (cfg.dominio || '').replace(/\/$/, '')
  html = html.replace(
    '<!-- @meta-dominio -->',
    base
      ? `<link rel="canonical" href="${base}/">\n  <meta property="og:url" content="${base}/">\n  <meta property="og:image" content="${base}/assets/img/og-eletron.jpg">`
      : '<meta property="og:image" content="/assets/img/og-eletron.jpg">',
  )
  return html
}

function verificar(html, rotulo) {
  const $ = cheerio.load(html)
  $('script, style').remove()
  const texto = $('body').text()
  const tracos = texto.match(/.{0,30}[—–].{0,30}/g)
  if (tracos) avisos.push(`[${rotulo}] travessão no texto (regra da casa): ${tracos.slice(0, 4).map((s) => JSON.stringify(s.trim())).join(' | ')}`)
  const sobrou = html.match(/\{\{[^}]+\}\}/g)
  if (sobrou) avisos.push(`[${rotulo}] marcadores sem valor: ${[...new Set(sobrou)].join(', ')}`)
  $('img').each((_, el) => {
    const src = ($(el).attr('src') || '?').slice(0, 60)
    if ($(el).attr('alt') === undefined) avisos.push(`[${rotulo}] img sem alt: ${src}`)
    if (!$(el).attr('width') || !$(el).attr('height')) avisos.push(`[${rotulo}] img sem width/height (salto de layout): ${src}`)
  })
  const ids = {}
  $('[id]').each((_, el) => {
    const id = $(el).attr('id')
    ids[id] = (ids[id] || 0) + 1
  })
  for (const [id, n] of Object.entries(ids)) if (n > 1) avisos.push(`[${rotulo}] id repetido: #${id} (${n}x)`)
  if (!argPreview)
    $('a[href^="#"]').each((_, el) => {
      const alvo = $(el).attr('href').slice(1)
      if (alvo && !ids[alvo]) avisos.push(`[${rotulo}] âncora sem destino: #${alvo}`)
    })
  if (!argPreview && $('h1').length !== 1) avisos.push(`[${rotulo}] ${$('h1').length} h1 na página (precisa ser 1)`)
}

// ---------------------------------------------------------------- execução
// No --publicar, dist sai do zero: a cópia só acrescenta, então arquivo que saiu de
// src/assets ficaria esquecido em dist e iria pro GitHub.
if (process.argv.includes('--publicar')) rmSync(DIST, { recursive: true, force: true })
copiarPasta(P('src/assets'), path.join(DIST, 'assets'))
copiarPasta(P('src/raiz'), DIST)

const kb = (s) => `${(Buffer.byteLength(s) / 1024).toFixed(1)} KB`
if (!argPreview) {
  const html = montar(null)
  verificar(html, 'página')
  gravar(path.join(DIST, 'index.html'), html)
  const base = (cfg.dominio || '').replace(/\/$/, '')
  gravar(path.join(DIST, 'robots.txt'), cfg.indexar ? `User-agent: *\nAllow: /\nDisallow: /preview/\n${base ? `Sitemap: ${base}/sitemap.xml\n` : ''}` : 'User-agent: *\nDisallow: /\n')
  if (base && cfg.indexar) gravar(path.join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${base}/</loc><lastmod>${new Date().toISOString().slice(0, 10)}</lastmod></url>\n</urlset>\n`)
  if (!base) avisos.push('dominio vazio no site.config.json: sem canonical e og:image relativo')
  // 404 própria (2026-11-27): página solta em src/404.html, a Vercel serve sozinha pra endereço que não existe
  if (existsSync(P('src/404.html'))) gravar(path.join(DIST, '404.html'), readFileSync(P('src/404.html'), 'utf8').replace(/\{\{cfg\.([\w.]+)\}\}/g, (_, c) => esc(valor(c))))
  if (process.argv.includes('--publicar')) rmSync(path.join(DIST, 'preview'), { recursive: true, force: true })
  console.log(`ok dist/index.html ${kb(html)} (${usados.size} ícones no sprite)`)
} else {
  const nome = argPreview.join('+')
  const html = montar(argPreview)
  verificar(html, `preview ${nome}`)
  gravar(path.join(DIST, `preview/${nome}.html`), html)
  console.log(`ok /preview/${nome}.html ${kb(html)}`)
}
if (avisos.length) console.log(`AVISOS:\n  ${[...new Set(avisos)].join('\n  ')}`)
