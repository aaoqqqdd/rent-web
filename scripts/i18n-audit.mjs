#!/usr/bin/env node
/**
 * i18n audit for rent-web (read-only; does not modify src/).
 *
 * Rebuilds the exact translation algorithm from the inline script at the end of
 * src/layout.ts and applies it to every Chinese string we can find in the SSR
 * templates / inline page scripts, so we can list what would stay Chinese in
 * EN mode. Also reports catalogue health (duplicate keys, identity values,
 * broad partial-fallback keys, risky regex patterns / replacement strings).
 *
 * Usage:  node scripts/i18n-audit.mjs [--json] [--max-lines N]
 *
 * How it works
 *   1. src/i18n.ts is transpiled with the installed `typescript` package
 *      (ts.transpileModule) and imported from a data: URL, so ENGLISH_COPY /
 *      ENGLISH_PATTERNS are evaluated exactly as the browser would evaluate
 *      the JSON that layout.ts injects.
 *   2. Every string-producing expression in src/pages/*.ts, src/components/*.ts
 *      and src/layout.ts is flattened to "would-be rendered text" (template
 *      chunks, binary concatenations; `${...}` becomes a § placeholder).
 *      Inline <script> bodies are split out and treated as runtime strings.
 *   3. The same lookup is run: exact ENGLISH_COPY key -> ENGLISH_PATTERNS in
 *      order -> longest-first partial phrase replacement -> leftover-Han
 *      segment replacement. Anything still containing Han is reported.
 */

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const ts = require('typescript')

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const HAN = /\p{Script=Han}/u
const HAN_RUN = /\p{Script=Han}+/gu
const jsonOut = process.argv.includes('--json')
const maxLinesArg = process.argv.indexOf('--max-lines')
const MAX_LINES = maxLinesArg >= 0 ? Number(process.argv[maxLinesArg + 1]) || 120 : 120

/* ------------------------------------------------------------------ */
/* 1. load the catalogue exactly as the browser sees it                */
/* ------------------------------------------------------------------ */

const i18nPath = path.join(ROOT, 'src/i18n.ts')
const i18nSource = fs.readFileSync(i18nPath, 'utf8')
const transpiled = ts.transpileModule(i18nSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  fileName: 'i18n.ts',
}).outputText
const i18nModule = await import(
  'data:text/javascript;base64,' + Buffer.from(transpiled, 'utf8').toString('base64')
)
const ENGLISH_COPY = i18nModule.ENGLISH_COPY
const ENGLISH_PATTERNS = i18nModule.ENGLISH_PATTERNS
const PATTERNS = ENGLISH_PATTERNS.map((entry) => [new RegExp(entry[0]), entry[1]])
const PHRASE_ENTRIES = Object.keys(ENGLISH_COPY)
  .filter((source) => source.length >= 2 && HAN.test(source))
  .sort((a, b) => b.length - a.length)

/**
 * Byte-for-byte reimplementation of englishFor() in the inline engine in
 * src/layout.ts: exact ENGLISH_COPY key -> first matching ENGLISH_PATTERNS
 * entry (with the same captured-group normalisation) -> null.
 * The old partial-phrase fallback was removed from the engine because it
 * produced mixed "Delivery 时段 / Services 费" output; unknown strings are
 * left in Chinese and must be added to the catalogue.
 */
function normalizePatternResult(value) {
  return String(value || '')
    .replaceAll('墨尔本 CBD 及周边地区', 'Melbourne CBD and nearby areas')
    .replaceAll('墨尔本 CBD', 'Melbourne CBD')
    .replaceAll('墨尔本', 'Melbourne')
    .replaceAll('、', ', ')
}

function englishFor(value) {
  const lookup = String(value || '').replace(/\s+/g, ' ').trim()
  if (!lookup) return null
  if (Object.prototype.hasOwnProperty.call(ENGLISH_COPY, lookup)) return ENGLISH_COPY[lookup]
  for (let i = 0; i < PATTERNS.length; i += 1) {
    if (PATTERNS[i][0].test(lookup)) return normalizePatternResult(lookup.replace(PATTERNS[i][0], PATTERNS[i][1]))
  }
  return null
}

// Literals that intentionally stay Chinese in the engine itself (not UI copy).
const RUNTIME_STRING_ALLOWLIST = new Set(['墨尔本', '墨尔本 CBD', '墨尔本 CBD 及周边地区'])
const hasHan = (text) => HAN.test(String(text || ''))
const isMixed = (text) => HAN.test(text) && /[A-Za-z]/.test(text)

/* ------------------------------------------------------------------ */
/* 2. catalogue health: duplicate keys, broad keys, identity, patterns */
/* ------------------------------------------------------------------ */

const sf = ts.createSourceFile(i18nPath, i18nSource, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS)
const lineOf = (node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1

function findVarInitializer(name) {
  let found = null
  const visit = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name &&
      node.initializer
    ) {
      found = node.initializer
      return
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return found
}

function stringKey(property) {
  if (!property.name) return null
  if (ts.isStringLiteral(property.name) || ts.isNoSubstitutionTemplateLiteral(property.name)) {
    return property.name.text
  }
  if (ts.isIdentifier(property.name)) return property.name.text
  return null
}

const copyObject = findVarInitializer('ENGLISH_COPY')
const copyEntries = []
const duplicates = []
const seenKeys = new Map()
if (copyObject && ts.isObjectLiteralExpression(copyObject)) {
  for (const prop of copyObject.properties) {
    if (!ts.isPropertyAssignment(prop)) continue
    const key = stringKey(prop)
    if (key == null) continue
    const value = ts.isStringLiteral(prop.initializer) ? prop.initializer.text : null
    const line = lineOf(prop.name)
    if (seenKeys.has(key)) {
      const first = seenKeys.get(key)
      duplicates.push({
        key,
        firstLine: first.line,
        duplicateLine: line,
        firstValue: first.value,
        duplicateValue: value,
        changesBehavior: first.value !== value,
      })
    } else {
      seenKeys.set(key, { line, value })
    }
    copyEntries.push({ key, value, line })
  }
}

const patternArray = findVarInitializer('ENGLISH_PATTERNS')
const patternEntries = []
if (patternArray && ts.isArrayLiteralExpression(patternArray)) {
  for (const element of patternArray.elements) {
    if (!ts.isArrayLiteralExpression(element) || element.elements.length < 2) continue
    const [sourceNode, replacementNode] = element.elements
    if (!ts.isStringLiteral(sourceNode) || !ts.isStringLiteral(replacementNode)) continue
    patternEntries.push({
      source: sourceNode.text,
      replacement: replacementNode.text,
      line: lineOf(sourceNode),
    })
  }
}

function countCaptureGroups(source) {
  let groups = 0
  for (let i = 0; i < source.length; i += 1) {
    if (source[i] === '\\') {
      i += 1
      continue
    }
    if (source[i] !== '(') continue
    if (source[i + 1] === '?') {
      // (?:, (?=, (?! are non-capturing / lookaround; (?<name> is capturing.
      if (source[i + 2] === '<' && source[i + 3] !== '=' && source[i + 3] !== '!') groups += 1
      continue
    }
    groups += 1
  }
  return groups
}

/** Walk a JS replacement string the way String.prototype.replace does. */
function analyseReplacement(replacement, groupCount) {
  const issues = []
  for (let i = 0; i < replacement.length; i += 1) {
    if (replacement[i] !== '$') continue
    const next = replacement[i + 1]
    if (next === '$') {
      i += 1
      continue
    }
    if (next === '&' || next === '`' || next === "'") {
      i += 1
      continue
    }
    if (next >= '0' && next <= '9') {
      let digits = next
      if (replacement[i + 2] >= '0' && replacement[i + 2] <= '9') digits += replacement[i + 2]
      const index = Number(digits)
      if (index === 0 || index > groupCount) {
        issues.push(`$${digits} has no capture group (pattern has ${groupCount}); literal "$${digits}" will be emitted`)
      }
      i += digits.length
      continue
    }
  }
  return issues
}

const patternDuplicates = []
const seenPatterns = new Map()
for (const entry of patternEntries) {
  if (seenPatterns.has(entry.source)) {
    patternDuplicates.push({
      source: entry.source,
      firstLine: seenPatterns.get(entry.source),
      duplicateLine: entry.line,
    })
  } else {
    seenPatterns.set(entry.source, entry.line)
  }
}

const riskyPatterns = []
for (const entry of patternEntries) {
  const issues = []
  if (patternDuplicates.some((dup) => dup.duplicateLine === entry.line)) {
    issues.push('duplicate regex: an earlier entry with the same pattern always wins -> this entry is unreachable')
  }
  let regex = null
  try {
    regex = new RegExp(entry.source)
  } catch (error) {
    issues.push(`invalid regex: ${error.message}`)
  }
  if (regex) {
    if (!entry.source.startsWith('^') && !entry.source.endsWith('$')) {
      issues.push('unanchored pattern (substring match can fire on unrelated text)')
    }
    if (HAN.test(entry.replacement) && !entry.replacement.includes('$')) {
      issues.push('replacement still contains Chinese')
    }
    issues.push(...analyseReplacement(entry.replacement, countCaptureGroups(entry.source)))
  }
  if (issues.length) riskyPatterns.push({ ...entry, issues })
}

/* broad partial-fallback keys: short Han keys that occur inside many others */
const phraseKeys = Object.keys(ENGLISH_COPY).filter((k) => k.length >= 2 && HAN.test(k))
const broadKeys = phraseKeys
  .map((key) => ({
    key,
    length: key.length,
    value: ENGLISH_COPY[key],
    line: copyEntries.find((e) => e.key === key)?.line ?? 0,
    containedIn: phraseKeys.filter((other) => other !== key && other.includes(key)).length,
  }))
  .filter((entry) => entry.length <= 4)
  .sort((a, b) => b.containedIn - a.containedIn || a.length - b.length)

const identityEntries = copyEntries.filter((entry) => entry.key === entry.value)

/* ------------------------------------------------------------------ */
/* 3. extract would-be-rendered strings from source                    */
/* ------------------------------------------------------------------ */

const SSR_FILES = [
  ...fs
    .readdirSync(path.join(ROOT, 'src/pages'))
    .filter((f) => f.endsWith('.ts'))
    .map((f) => `src/pages/${f}`),
  ...fs
    .readdirSync(path.join(ROOT, 'src/components'))
    .filter((f) => f.endsWith('.ts'))
    .map((f) => `src/components/${f}`),
  'src/layout.ts',
]

const UNSAFE_HAN = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/u
const PLACEHOLDER = '\u00a7' // §

let currentFileText = ''

// Raw template text (not cooked by TS) so escaped sequences such as \n inside
// inline scripts survive and the extracted JavaScript can be parsed.
function rawTemplateBody(node) {
  const raw = currentFileText.slice(node.getStart(), node.end)
  return raw.slice(1, -1)
}
function replaceInterpolations(raw) {
  let out = ''
  let i = 0
  while (i < raw.length) {
    if (raw[i] === '$' && raw[i + 1] === '{') {
      let depth = 1
      let j = i + 2
      let quote = ''
      while (j < raw.length && depth > 0) {
        const ch = raw[j]
        if (quote) {
          if (ch === '\\') { j += 2; continue }
          if (ch === quote) quote = ''
          j += 1
          continue
        }
        if (ch === "'" || ch === '"' || ch === '`') { quote = ch; j += 1; continue }
        if (ch === '{') depth += 1
        else if (ch === '}') depth -= 1
        j += 1
      }
      out += PLACEHOLDER
      i = j
      continue
    }
    out += raw[i]
    i += 1
  }
  return out
}

function flattenStringExpression(node) {
  // Returns an array of alternative flattened strings (conditionals -> 2).
  if (!node) return []
  if (ts.isStringLiteral(node)) return [node.text]
  if (ts.isNoSubstitutionTemplateLiteral(node)) {
    if (!currentFileText) return [node.text]
    return [rawTemplateBody(node)]
  }
  if (ts.isTemplateExpression(node)) {
    if (!currentFileText) {
      let cooked = node.head.text
      for (const span of node.templateSpans) cooked += PLACEHOLDER + span.literal.text
      return [cooked]
    }
    return [replaceInterpolations(rawTemplateBody(node))]
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = flattenStringExpression(node.left)
    const right = flattenStringExpression(node.right)
    if (!left.length || !right.length) return [PLACEHOLDER]
    const out = []
    for (const l of left) for (const r of right) out.push(l + r)
    return out.slice(0, 8)
  }
  if (ts.isParenthesizedExpression(node)) return flattenStringExpression(node.expression)
  if (ts.isConditionalExpression(node)) {
    return [...flattenStringExpression(node.whenTrue), ...flattenStringExpression(node.whenFalse)]
  }
  if (ts.isCallExpression(node)) {
    // Only unwrap known string helpers; arbitrary calls (summaryRow(row), etc.)
    // are opaque dynamic values, otherwise sibling + operands get concatenated
    // into one bogus "sentence".
    const callee = ts.isIdentifier(node.expression) ? node.expression.text : ''
    // Bilingual helpers already carry an explicit English branch; their result
    // is an opaque, already-localized value to the DOM translator.
    const bilingualWrappers = new Set(['uiText', 'bilingual', 'currentCopy', 'cartText'])
    if (bilingualWrappers.has(callee)) return [PLACEHOLDER]
    const wrappers = new Set(['esc', 'String', 'translate', 't', 'uiCopy'])
    const arg = node.arguments[0]
    return arg && wrappers.has(callee) ? flattenStringExpression(arg) : [PLACEHOLDER]
  }
  return [PLACEHOLDER]
}

function isStringishExpression(node) {
  if (!node) return false
  return (
    ts.isStringLiteral(node) ||
    ts.isNoSubstitutionTemplateLiteral(node) ||
    ts.isTemplateExpression(node) ||
    (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) ||
    ts.isConditionalExpression(node) ||
    (ts.isParenthesizedExpression(node) && isStringishExpression(node.expression))
  )
}

const allTexts = new Set()
const findings = new Map() // key -> {source, category, kind, count, locations:[], outputs:Set}
function record(source, category, kind, file, line, extra = {}) {
  const text = source.replace(/\s+/g, ' ').trim()
  if (!text || !hasHan(text)) return
  if (text === '中') return // intentional zh option label; marked data-no-translate in site-header
  if (extra.resolveLine) {
    const resolved = extra.resolveLine(text)
    if (resolved) line = resolved
  }
  const key = `${category}\u0000${kind}\u0000${text}`
  if (!findings.has(key)) {
    findings.set(key, {
      source: text,
      category,
      kind,
      translatable: extra.translatable !== false,
      count: 0,
      locations: [],
      outputs: new Set(),
      translatedFor: extra.translatedFor || [],
    })
  }
  const entry = findings.get(key)
  entry.count += 1
  if (entry.locations.length < 8 && !entry.locations.some((l) => l.file === file && l.line === line)) {
    entry.locations.push({ file, line })
  }
  for (const output of extra.translatedFor || []) entry.outputs.add(output)
}

/** Run the same lookup the browser runs and return the would-be EN text. */
function translate(text) {
  const trimmed = text.replace(/\s+/g, ' ').trim()
  // The engine calls englishFor(trimmed); placeholders are dynamic values, so
  // try a numeric and a generic substitution to avoid false positives.
  const variants = [trimmed]
  if (trimmed.includes(PLACEHOLDER)) {
    variants.push(trimmed.replaceAll(PLACEHOLDER, '3'))
    variants.push(trimmed.replaceAll(PLACEHOLDER, 'X'))
    variants.push(trimmed.replaceAll(PLACEHOLDER, ''))
  }
  let last = null
  for (const variant of variants) {
    const output = englishFor(variant)
    if (output == null) continue
    last = output
    if (!hasHan(output)) return { output, covered: true }
  }
  return { output: last == null ? trimmed : last, covered: false }
}

function processSsSegment(text, file, line, resolveLine) {
  const trimmed = text.replace(/\s+/g, ' ').trim()
  if (!trimmed || !hasHan(trimmed)) return
  allTexts.add(trimmed)
  const result = translate(trimmed)
  if (result.covered) return
  record(trimmed, 'SSR text', 'untranslated', file, line, { translatedFor: [result.output], resolveLine })
}

function processHtmlChunk(chunk, file, line, resolveLine) {
  // Attributes first (values are removed with the tag later).
  const attrRe = /\s([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*"([^"]*)"|\s([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*'([^']*)'/g
  let match
  while ((match = attrRe.exec(chunk))) {
    const name = (match[1] || match[3] || '').toLowerCase()
    const value = match[2] != null ? match[2] : match[4]
    if (!value || !hasHan(value)) continue
    if (/-zh$|-en$/.test(name)) continue // data-*-zh / data-*-en: paired by render* helpers
    allTexts.add(value.replace(/\s+/g, ' ').trim())
    const translatable =
      name === 'placeholder' ||
      name === 'aria-label' ||
      name === 'title' ||
      name === 'alt' ||
      name === 'value' ||
      name === 'aria-valuetext' ||
      name === 'aria-roledescription'
    if (!translatable) {
      record(value, 'Attribute', name, file, line, { translatable: false, resolveLine })
      continue
    }
    const result = translate(value)
    if (!result.covered) record(value, 'Attribute', name, file, line, { translatedFor: [result.output], resolveLine })
  }
  // Text nodes are split by tags only — newlines inside one text node collapse
  // to spaces in the DOM, so they must not start a new "run".
  const textOnly = chunk.replace(/<[^>]*>/g, '\u0000')
  for (const run of textOnly.split('\u0000')) processSsSegment(run, file, line, resolveLine)
}

// TS gives template-literal text with escapes already cooked (a literal \n in
// the inline script becomes a real newline), which would make the extracted JS
// unparseable ("Unterminated string literal"). Re-escape control characters
// inside quoted strings before parsing; template literals keep their newlines.
function reescapeForParse(text) {
  let out = ''
  let quote = ''
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (quote === '`') {
      out += ch
      if (ch === '\\') { if (i + 1 < text.length) out += text[++i] }
      else if (ch === '`') quote = ''
      continue
    }
    if (quote) {
      if (ch === '\\') { out += ch; if (i + 1 < text.length) out += text[++i]; continue }
      if (ch === quote) { quote = ''; out += ch; continue }
      if (ch === '\n') { out += '\\n'; continue }
      if (ch === '\r') continue
      if (ch === '\t') { out += '\\t'; continue }
      if (ch.charCodeAt(0) < 0x20) { out += '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0'); continue }
      out += ch
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; out += ch; continue }
    out += ch
  }
  return out
}

function processScriptChunk(body, file, line, resolveLine) {
  // Parse the inline script as JavaScript so we only audit real string
  // expressions (concatenations stay whole; comments/code never leak in).
  // Raw template text carries one extra escape level compared with the JavaScript
  // the browser executes (\d in source -> \d at runtime). Decode one level.
  const decoded = body.replace(/\\\\/g, '\\')
  const cleaned = reescapeForParse(decoded.replaceAll(PLACEHOLDER, '(__dynamic__)'))
  let jsFile = ts.createSourceFile(file + '.inline.js', cleaned, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS)
  if (jsFile.parseDiagnostics && jsFile.parseDiagnostics.length > 0) {
    // Fall back to quoted-string extraction when the script is not parseable.
    const quoteRe = /(['"])((?:\\.|(?!\1)[^\\])*)\1/g
    let m
    while ((m = quoteRe.exec(body))) {
      const value = m[2]
      if (!hasHan(value)) continue
      if (value.includes('<')) processHtmlChunk(value, file, line, resolveLine)
      else {
        if (RUNTIME_STRING_ALLOWLIST.has(value)) continue
        const result = translate(value)
        if (!result.covered) {
          record(value, 'Inline JS string', 'runtime-untranslated', file, line, { translatedFor: [result.output], resolveLine })
        }
      }
    }
    return
  }
  const visit = (node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const callee = node.expression.text
      if ((callee === 'uiText' || callee === 'bilingual' || callee === 'currentCopy' || callee === 'cartText') && node.arguments.length >= 2 && node.arguments[1]) {
        // Both language branches are supplied explicitly at the call site, so
        // the Chinese branch never goes through the DOM translator.
        for (const argument of node.arguments.slice(2)) visit(argument)
        return
      }
    }
    if (ts.isObjectLiteralExpression(node)) {
      const names = new Set(node.properties.filter(ts.isPropertyAssignment).map((prop) => stringKey(prop)))
      if (names.has('zh') && names.has('en')) return // explicit bilingual pair
      const parent = node.parent
      if (parent && ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name) && parent.name.text === 'translations') {
        return // layout.ts data-i18n translations map is applied by setLanguage()
      }
    }
    if (ts.isConditionalExpression(node)) {
      const test = node.condition.getText()
      if (/isEnglish|englishCalendar|currentLang|GeekSlopeI18n.*language|currentCopy/.test(test)) return
    }
    if (isStringishExpression(node)) {
      const parent = node.parent
      const parentIsStringish =
        parent &&
        ((ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.PlusToken) ||
          ts.isTemplateSpan(parent) ||
          ts.isTemplateExpression(parent) ||
          ts.isParenthesizedExpression(parent) ||
          ts.isConditionalExpression(parent))
      if (!parentIsStringish) {
        for (const value of flattenStringExpression(node)) {
          if (!value || !hasHan(value)) continue
          allTexts.add(value.replace(/\s+/g, ' ').trim())
          if (value.includes('<')) {
            processHtmlChunk(value, file, line, resolveLine)
            continue
          }
          if (RUNTIME_STRING_ALLOWLIST.has(value)) continue
          const result = translate(value)
          if (!result.covered) {
            record(value, 'Inline JS string', 'runtime-untranslated', file, line, { translatedFor: [result.output], resolveLine })
          }
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(jsFile)
}

function scanFile(relativePath) {
  const absolute = path.join(ROOT, relativePath)
  const source = fs.readFileSync(absolute, 'utf8')
  currentFileText = source
  const sourceFile = ts.createSourceFile(absolute, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS)
  const resolveLine = (text) => {
    const cleaned = text.replaceAll(PLACEHOLDER, '').trim()
    if (!cleaned) return null
    for (const needle of [cleaned.slice(0, 40), cleaned.split(/\s+/)[0].slice(0, 16)]) {
      if (!needle || !hasHan(needle)) continue
      const index = source.indexOf(needle)
      if (index >= 0) return source.slice(0, index).split('\n').length
    }
    return null
  }

  const visit = (node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const callee = node.expression.text
      if ((callee === 'uiText' || callee === 'bilingual' || callee === 'currentCopy' || callee === 'cartText') && node.arguments.length >= 2 && node.arguments[1]) {
        // Both language branches are supplied explicitly at the call site, so
        // the Chinese branch never goes through the DOM translator.
        for (const argument of node.arguments.slice(2)) visit(argument)
        return
      }
    }
    if (ts.isObjectLiteralExpression(node)) {
      const names = new Set(node.properties.filter(ts.isPropertyAssignment).map((prop) => stringKey(prop)))
      if (names.has('zh') && names.has('en')) return // explicit bilingual pair
      const parent = node.parent
      if (parent && ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name) && parent.name.text === 'translations') {
        return // layout.ts data-i18n translations map is applied by setLanguage()
      }
    }
    if (ts.isConditionalExpression(node)) {
      const test = node.condition.getText()
      if (/isEnglish|englishCalendar|currentLang|GeekSlopeI18n.*language|currentCopy/.test(test)) return
    }
    if (isStringishExpression(node)) {
      const parent = node.parent
      const parentIsStringish =
        parent &&
        ((ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.PlusToken) ||
          ts.isTemplateSpan(parent) ||
          ts.isTemplateExpression(parent) ||
          ts.isParenthesizedExpression(parent) ||
          ts.isConditionalExpression(parent))
      if (!parentIsStringish) {
        const line = lineOf(node)
        for (const chunk of flattenStringExpression(node)) {
          if (!chunk || !hasHan(chunk)) continue
          // Separate inline <script> blocks from markup.
          const scriptRe = /<script\b[^>]*>([\s\S]*?)<\/script>/gi
          let lastIndex = 0
          let scriptMatch
          const htmlParts = []
          while ((scriptMatch = scriptRe.exec(chunk))) {
            htmlParts.push(chunk.slice(lastIndex, scriptMatch.index))
            processScriptChunk(scriptMatch[1], relativePath, line, resolveLine)
            lastIndex = scriptMatch.index + scriptMatch[0].length
          }
          htmlParts.push(chunk.slice(lastIndex))
          processHtmlChunk(htmlParts.join('\n'), relativePath, line, resolveLine)
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
}
for (const file of SSR_FILES) scanFile(file)

/* ------------------------------------------------------------------ */
/* 4. page metadata (index.ts title/description) & JSON-LD            */
/* ------------------------------------------------------------------ */

const metadataGaps = []
if (fs.existsSync(path.join(ROOT, 'src/index.ts'))) {
  const indexPath = path.join(ROOT, 'src/index.ts')
  const indexSource = fs.readFileSync(indexPath, 'utf8')
  currentFileText = indexSource
  const indexFile = ts.createSourceFile(indexPath, indexSource, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS)
  const visit = (node) => {
    if (ts.isPropertyAssignment(node)) {
      const name = ts.isIdentifier(node.name) || ts.isStringLiteral(node.name) ? node.name.text : ''
      if (name === 'title' || name === 'description') {
        for (const chunk of flattenStringExpression(node.initializer)) {
          if (!chunk || !hasHan(chunk)) continue
          const trimmed = chunk.replace(/\s+/g, ' ').trim()
          const result = translate(trimmed)
          if (!result.covered) {
            metadataGaps.push({
              field: name,
              source: trimmed,
              output: result.output,
              line: lineOf(node.name),
            })
          }
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(indexFile)
}

const jsonLdNotice = {
  note:
    'src/layout.ts:48-55 embeds Chinese JSON-LD (Organization/WebSite inLanguage zh-CN, FAQPage in content.ts). ' +
    'No client code rewrites JSON-LD, so structured data stays Chinese in EN mode.',
}

/* pattern shadow analysis: a pattern is suspicious when every known sample
   it matches is already claimed by an earlier pattern (or an exact key). */
const shadowedPatterns = []
for (let i = 0; i < patternEntries.length; i += 1) {
  const entry = patternEntries[i]
  let regex
  try {
    regex = new RegExp(entry.source)
  } catch {
    continue
  }
  const samples = [...allTexts].filter((text) => regex.test(text) && !(text in ENGLISH_COPY))
  if (!samples.length) continue
  const winners = samples.map((text) => {
    for (let j = 0; j < i; j += 1) {
      try {
        if (new RegExp(patternEntries[j].source).test(text)) return j
      } catch {
        /* ignore */
      }
    }
    return -1
  })
  if (winners.every((winner) => winner !== -1)) {
    shadowedPatterns.push({ ...entry, samples: samples.slice(0, 3) })
  }
}

/* which catalogue keys the partial fallback actually fires on in our corpus */
const oneCharKeys = copyEntries.filter((entry) => entry.key.length === 1 && HAN.test(entry.key))
const partialUsage = phraseKeys
  .map((key) => {
    const hits = [...allTexts].filter((text) => text.includes(key))
    return {
      key,
      value: ENGLISH_COPY[key],
      line: copyEntries.find((entry) => entry.key === key)?.line ?? 0,
      hits: hits.length,
      examples: hits.slice(0, 2).map((text) => ({ source: text, output: translate(text).output })),
    }
  })
  .filter((entry) => entry.hits > 0)
  .sort((a, b) => b.hits - a.hits || a.key.length - b.key.length)

/* ------------------------------------------------------------------ */
/* 5. report                                                          */
/* ------------------------------------------------------------------ */

const list = [...findings.values()].sort(
  (a, b) => b.count - a.count || b.source.length - a.source.length || a.source.localeCompare(b.source),
)
const byCategory = (category) => list.filter((entry) => entry.category === category)
const fmtLocation = (loc) => `${loc.file}:${loc.line}`

if (jsonOut) {
  console.log(
    JSON.stringify(
      {
        catalogue: {
          copyKeys: Object.keys(ENGLISH_COPY).length,
          patternCount: ENGLISH_PATTERNS.length,
          duplicateKeys: duplicates,
          identityEntries,
          broadKeys: broadKeys.slice(0, 40),
          oneCharKeys,
          partialUsage,
          riskyPatterns,
          patternDuplicates,
          shadowedPatterns,
        },
        metadataGaps,
        jsonLdNotice,
        gaps: list.map((entry) => ({ ...entry, outputs: [...entry.outputs] })),
      },
      null,
      2,
    ),
  )
  process.exit(0)
}

const line = (char = '─') => console.log(char.repeat(78))
line('═')
console.log('rent-web i18n audit — reuses the exact layout.ts lookup algorithm')
line('═')
console.log(
  `Catalogue: ${Object.keys(ENGLISH_COPY).length} ENGLISH_COPY keys, ` +
    `${ENGLISH_PATTERNS.length} ENGLISH_PATTERNS, ` +
    `${PHRASE_ENTRIES.length} keys usable by the partial-phrase fallback.`,
)
console.log(`Sources scanned: ${SSR_FILES.join(', ')} (+ src/index.ts metadata)`)
console.log(`Untranslated findings: ${list.length} (${list.reduce((sum, e) => sum + e.count, 0)} occurrences)`)

line()
console.log(`A. DUPLICATE ENGLISH_COPY KEYS (${duplicates.length})`)
if (!duplicates.length) console.log('  none')
for (const dup of duplicates.slice(0, 40)) {
  console.log(
    `  ${dup.key}  first at i18n.ts:${dup.firstLine} = ${JSON.stringify(dup.firstValue)}` +
      `, DUPLICATE at i18n.ts:${dup.duplicateLine} = ${JSON.stringify(dup.duplicateValue)}` +
      (dup.changesBehavior ? '  <-- silently overrides the first value' : '  (identical value)'),
  )
}

line()
console.log(`B. IDENTITY TRANSLATIONS (key === value, ${identityEntries.length})`)
for (const entry of identityEntries.slice(0, 20)) {
  console.log(`  i18n.ts:${entry.line}  ${JSON.stringify(entry.key)}`)
}

line()
console.log(`C. RISKY PATTERNS / REPLACEMENTS (${riskyPatterns.length})`)
if (!riskyPatterns.length) console.log('  none')
for (const entry of riskyPatterns.slice(0, 40)) {
  console.log(`  i18n.ts:${entry.line}  /${entry.source}/ -> ${JSON.stringify(entry.replacement)}`)
  for (const issue of entry.issues) console.log(`      - ${issue}`)
}
if (patternDuplicates.length) {
  console.log(`  duplicate pattern regexes (${patternDuplicates.length}) — later duplicate is unreachable:`)
  for (const dup of patternDuplicates.slice(0, 20)) {
    console.log(`    /${dup.source}/ first i18n.ts:${dup.firstLine}, duplicate i18n.ts:${dup.duplicateLine}`)
  }
}

line()
console.log(`C2. POSSIBLY SHADOWED PATTERNS (every known sample is also matched by an EARLIER pattern): ${shadowedPatterns.length}`)
for (const entry of shadowedPatterns.slice(0, 20)) {
  console.log(`  i18n.ts:${entry.line}  /${entry.source}/`)
  for (const sample of entry.samples) console.log(`      sample that an earlier pattern claims first: ${JSON.stringify(sample)}`)
}

line()
console.log('D. BROADEST PARTIAL-FALLBACK KEYS (length <= 4, most often a substring of other keys)')
for (const entry of broadKeys.slice(0, 20)) {
  console.log(
    `  i18n.ts:${entry.line}  ${JSON.stringify(entry.key)} -> ${JSON.stringify(entry.value)}` +
      `  (contained in ${entry.containedIn} other keys)`,
  )
}

line()
console.log(`D2. PARTIAL-FALLBACK KEYS THAT ACTUALLY FIRE IN THE SOURCE CORPUS (${partialUsage.length} keys)`)
for (const entry of partialUsage.slice(0, 25)) {
  console.log(
    `  i18n.ts:${entry.line}  ${JSON.stringify(entry.key)} -> ${JSON.stringify(entry.value)}  (${entry.hits} corpus strings)`,
  )
  for (const example of entry.examples) {
    console.log(`      ${JSON.stringify(example.source)} -> ${JSON.stringify(example.output)}`)
  }
}

line()
console.log(`D3. SINGLE-HAN-CHAR KEYS (${oneCharKeys.length}) — usable by the leftover-Han segment replacement at layout.ts:135`)
for (const entry of oneCharKeys.slice(0, 30)) {
  console.log(`  i18n.ts:${entry.line}  ${JSON.stringify(entry.key)} -> ${JSON.stringify(entry.value)}`)
}

function printGaps(title, category, kind, translatable) {
  const gaps = list.filter(
    (entry) =>
      entry.category === category &&
      (!kind || entry.kind === kind) &&
      (translatable === undefined || entry.translatable === translatable),
  )
  line()
  console.log(`${title} (${gaps.length})`)
  if (!gaps.length) {
    console.log('  none')
    return
  }
  for (const entry of gaps.slice(0, MAX_LINES)) {
    const locations = entry.locations.map(fmtLocation).join(', ')
    console.log(`  ×${entry.count}  ${JSON.stringify(entry.source)}  [${entry.kind}]`)
    console.log(`        at ${locations}`)
    const outputs = [...entry.outputs].filter((o) => o && o !== entry.source)
    if (outputs.length) console.log(`        EN would render: ${JSON.stringify(outputs[0])}`)
  }
  if (gaps.length > MAX_LINES) console.log(`  … ${gaps.length - MAX_LINES} more (use --max-lines)`)
}

printGaps('E. SSR TEXT WITH NO TRANSLATION (stays Chinese in EN mode)', 'SSR text', 'untranslated')
printGaps('E2. placeholder/aria-label/title THAT STILL FAIL', 'Attribute', undefined, true)
printGaps('F. ATTRIBUTES THE ENGINE NEVER TRANSLATES (alt/value/aria-describedby/data-* …)', 'Attribute', undefined, false)
printGaps('G. INLINE-JS RUNTIME STRINGS WITH NO TRANSLATION', 'Inline JS string', 'runtime-untranslated')

line()
console.log(`H. PAGE METADATA / JSON-LD (${metadataGaps.length} gaps in src/index.ts title/description)`)
for (const gap of metadataGaps.slice(0, 30)) {
  console.log(`  src/index.ts:${gap.line}  ${gap.field}: ${JSON.stringify(gap.source)}`)
  console.log(`        document.title/meta would render: ${JSON.stringify(gap.output)}`)
}
console.log(`  ${jsonLdNotice.note}`)

line()
const mixed = list.filter((entry) => [...entry.outputs].some((o) => isMixed(o)))
console.log(`I. PARTIAL / MIXED-TRANSLATION FINDINGS (output contains both English and Chinese): ${mixed.length}`)
for (const entry of mixed.slice(0, 30)) {
  const output = [...entry.outputs].find((o) => isMixed(o))
  console.log(`  ${JSON.stringify(entry.source)}`)
  console.log(`      -> ${JSON.stringify(output)}  (${fmtLocation(entry.locations[0])})`)
}
line('═')
console.log('Re-run: node scripts/i18n-audit.mjs   (or --json for machine-readable output)')
