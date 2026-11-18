/**
 * Imagens e vídeos do site em src/assets (AVIF e WebP em várias larguras, com manifesto.json pro
 * width/height do <img>). Base do 08-inter. Origem: "../0112 - Eletron Paulista".
 *
 * - Vídeo do hero: os 3 MP4 que o video-hero/montar-video.mjs gera (1280, 854 e o recorte em pé
 *   do celular) e as capas, que são o 1º quadro de cada um (LCP).
 * - Logo branca do topo, recortada no limite do desenho.
 * - Abertura: a logo branca separada em 5 camadas do mesmo tamanho, pela cor de cada pixel, pra
 *   cada peça entrar no seu tempo (EP, barra verde, barra amarela, ELETRON, PAULISTA).
 * - Favicons: o EP com as barras.
 *
 * Uso: node scripts/processar-imagens.mjs   (ou npm run imagens)
 */
import sharp from 'sharp'
import { mkdirSync, writeFileSync, rmSync, readdirSync, copyFileSync } from 'node:fs'
import path from 'node:path'

const R = '../0112 - Eletron Paulista'
const OUT = 'src/assets/img'
const VID = 'src/assets/video'
for (const p of [OUT, VID, 'src/raiz', 'src/assets/fonts']) mkdirSync(p, { recursive: true })
for (const f of readdirSync(OUT)) rmSync(path.join(OUT, f), { recursive: true, force: true })
const manifesto = {}

async function gravar(pipeline, nome) {
  const info = await pipeline.toFile(path.join(OUT, nome))
  manifesto[nome] = { w: info.width, h: info.height, kb: Math.round(info.size / 1024) }
}
async function variantes(origem, nome, larguras, { q = 80, formatos = ['avif', 'webp'] } = {}) {
  for (const w of larguras) {
    for (const f of formatos) {
      let p = sharp(origem).resize({ width: w, withoutEnlargement: true, kernel: 'lanczos3' })
      p = f === 'avif' ? p.avif({ quality: q - 14, effort: 7 }) : p.webp({ quality: q, effort: 6, alphaQuality: 92 })
      await gravar(p, `${nome}-${w}.${f}`)
    }
  }
}

// ---------------------------------------------------------------- vídeo do hero e capas
for (const f of ['hero-1280.mp4', 'hero-854.mp4', 'hero-celular.mp4']) copyFileSync(`${R}/video-hero/saida/${f}`, `${VID}/${f}`)
await variantes(`${R}/video-hero/saida/hero-capa.png`, 'hero-capa', [854, 1280], { q: 78 })
await variantes(`${R}/video-hero/saida/hero-capa-celular.png`, 'hero-capa-celular', [440], { q: 78 })

// ---------------------------------------------------------------- logo branca (topo)
const LOGO = `${R}/Recursos Site/LOGOS/Logo Horizontal Branca.png`
const logoRecorte = await sharp(LOGO).trim({ threshold: 1 }).png().toBuffer()
await variantes(logoRecorte, 'logo-branca', [240, 480], { formatos: ['webp'], q: 90 })

// ---------------------------------------------------------------- abertura em camadas
// Cada pixel vai pra uma camada pela cor (branco, verde ou amarelo) e pelo lado (o símbolo EP
// termina antes de x = 900 na logo original de 2480 px). Mesmo tamanho em todas, empilhadas.
{
  const { data, info } = await sharp(logoRecorte).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width: W, height: H } = info
  // fronteira do símbolo no recorte: a logo original começa em x = 147
  const corte = 900 - 147
  const camadas = { 'ab-ep': [], 'ab-verde': [], 'ab-amarelo': [], 'ab-eletron': [], 'ab-paulista': [] }
  for (const k in camadas) camadas[k] = Buffer.alloc(W * H * 4)
  for (let i = 0; i < W * H; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2], a = data[i * 4 + 3]
    if (!a) continue
    const x = i % W
    const esquerda = x < corte
    let k
    if (r > 200 && g > 200 && b > 200) k = esquerda ? 'ab-ep' : 'ab-eletron'
    else if (r > 180 && g > 160 && b < 120) k = 'ab-amarelo'
    else if (g > r && g > b) k = esquerda ? 'ab-verde' : 'ab-paulista'
    else k = esquerda ? 'ab-ep' : 'ab-eletron'
    camadas[k].set([r, g, b, a], i * 4)
  }
  for (const [nome, buf] of Object.entries(camadas)) {
    const png = await sharp(buf, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer()
    await variantes(png, nome, [720, 1200], { formatos: ['webp'], q: 90 })
  }
  manifesto._abertura = { w: W, h: H }
}

// ---------------------------------------------------------------- imagens das seções
// Fonte: imagens-finais/ (tiradas dos mockups aprovados no ChatGPT) e os recortes feitos pelos
// scripts Python (equipamentos e cabeça do instrutor, em scripts/.cache).
const FIM = `${R}/imagens-finais`
const FOTOS = `${R}/Recursos Site/FOTOS CURSO`

// 03 · treinamento: os 3 equipamentos recortados (flutuam) e as 3 fotos dos cartões (4:3)
for (const n of ['monitor', 'receptor', 'modulo']) await variantes(`scripts/.cache/equipamentos/${n}.png`, `equip-${n}`, [360, 560], { formatos: ['webp'], q: 86 })
await variantes(`${FIM}/cartao-1-osciloscopio.png`, 'cartao-osciloscopio', [480, 800], { q: 80 })
await variantes(`${FIM}/cartao-2-microscopio.png`, 'cartao-microscopio', [480, 800], { q: 80 })
await variantes(`${FIM}/cartao-3-instrutor-com-aluno.png`, 'cartao-instrutor', [480, 800], { q: 80 })

// 06 · programa: fotos dos 5 cartões, recortadas do mockup aprovado e ampliadas 4x (Swin2SR),
// e a faixa de lavoura em perspectiva do pé da seção
for (let i = 1; i <= 5; i++) await variantes(`${FIM}/programa/dia-${i}.png`, `programa-dia-${i}`, [360, 640], { q: 78 })
await variantes(`${FIM}/programa/lavoura-faixa.png`, 'programa-lavoura', [1032], { q: 80 })

// 04 · sobre: a foto inteira e, por cima, a camada só com a cabeça (mesmo tamanho, alinhadas)
await variantes(`${FIM}/sobre-desktop.png`, 'sobre-foto', [960, 1536], { q: 80 })
await variantes(`${FIM}/sobre-celular.png`, 'sobre-foto-movel', [640, 1024], { q: 80 })
await variantes('scripts/.cache/sobre/recorte-desktop.png', 'sobre-recorte', [960, 1536], { formatos: ['webp'], q: 86 })
await variantes('scripts/.cache/sobre/recorte-celular.png', 'sobre-recorte-movel', [640, 1024], { formatos: ['webp'], q: 86 })

// 07 · turma: 4 fotos em retrato 3:4. A 1ª veio tratada do ChatGPT; as outras 3 são as reais,
// recortadas em 3:4 em volta da pessoa, com um ajuste de cor pra chegar perto do tratamento dela
await variantes(`${FIM}/turma-1-instrutor-em-pe.png`, 'turma-1', [420, 700], { q: 80 })
const TURMA = [
  ['DSC01164', 'turma-2', 0.5],
  ['DSC01183', 'turma-3', 0.42],
  ['DSC09453', 'turma-4', 0.55],
]
for (const [arq, nome, cx] of TURMA) {
  const img = sharp(`${FOTOS}/${arq}.JPG`).rotate()
  const { width: w, height: h } = await img.metadata()
  const larg = Math.round((h * 3) / 4)
  const left = Math.max(0, Math.min(w - larg, Math.round(w * cx - larg / 2)))
  const buf = await sharp(`${FOTOS}/${arq}.JPG`).rotate().extract({ left, top: 0, width: larg, height: h })
    .modulate({ saturation: 1.12, brightness: 1.02 }).linear(1.08, -10).sharpen({ sigma: 0.6 }).toBuffer()
  await variantes(buf, nome, [420, 700], { q: 80 })
}

// ---------------------------------------------------------------- favicons (o EP com as barras)
{
  const simbolo = await sharp(`${R}/Recursos Site/LOGOS/Logo.png`).extract({ left: 0, top: 0, width: 240, height: 150 }).trim({ threshold: 1 }).png().toBuffer()
  const quadrado = async (lado, fundo) => {
    const m = await sharp(simbolo).resize({ width: Math.round(lado * 0.78), height: Math.round(lado * 0.78), fit: 'inside' }).toBuffer()
    return sharp({ create: { width: lado, height: lado, channels: 4, background: fundo } }).composite([{ input: m, gravity: 'center' }]).png()
  }
  await (await quadrado(32, { r: 255, g: 255, b: 255, alpha: 0 })).toFile('src/raiz/favicon-32.png')
  await (await quadrado(180, { r: 255, g: 255, b: 255, alpha: 1 })).toFile('src/raiz/apple-touch-icon.png')
}

writeFileSync(path.join(OUT, 'manifesto.json'), JSON.stringify(manifesto, null, 1))
console.log('ok', Object.keys(manifesto).length, 'arquivos')
