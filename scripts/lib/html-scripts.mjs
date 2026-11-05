import { DomUtils, parseDocument } from 'htmlparser2'

// Preserve raw script text and source offsets for syntax checks and the i18n audit.
export function htmlScripts(html) {
  const document = parseDocument(html, { withStartIndices: true, withEndIndices: true })
  return DomUtils.getElementsByTagName('script', document.children).map(node => {
    // The parser's closing offset can precede ignored end-tag attributes.
    const closingBracket = html.indexOf('>', node.endIndex)
    return {
      attributes: node.attribs,
      code: DomUtils.textContent(node),
      startIndex: node.startIndex,
      endIndex: closingBracket < 0 ? html.length : closingBracket + 1,
    }
  })
}
