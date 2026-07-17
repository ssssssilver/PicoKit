import fs from "node:fs"
import path from "node:path"
import ts from "typescript"

const roots = ["app", "components", "lib"]
const files = roots.flatMap(walk).filter((file) => /\.(?:ts|tsx)$/.test(file))
const staticEnglish = new Set()
const dynamicPickCalls = []

for (const file of files) {
  const sourceText = fs.readFileSync(file, "utf8")
  const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  visit(source)

  function visit(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "pick" && node.arguments.length >= 2) {
      const english = readStaticText(node.arguments[1])
      if (english) staticEnglish.add(english)
      else dynamicPickCalls.push(`${file}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1} ${node.arguments[1].getText(source)}`)
    }

    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      if (node.tagName.getText(source) === "Localized") {
        const en = node.attributes.properties.find((attribute) => ts.isJsxAttribute(attribute) && attribute.name.getText(source) === "en")
        if (en && ts.isJsxAttribute(en)) {
          const english = readJsxAttribute(en)
          if (english) staticEnglish.add(english)
        }
      }
    }

    if (ts.isPropertyAssignment(node)) {
      const name = node.name.getText(source).replace(/["']/g, "")
      if (name === "en" || name.endsWith("En")) {
        const english = readStaticText(node.initializer)
        if (english) staticEnglish.add(english)
      }
    }
    ts.forEachChild(node, visit)
  }

  function readJsxAttribute(attribute) {
    if (!attribute.initializer) return ""
    if (ts.isStringLiteral(attribute.initializer)) return attribute.initializer.text.trim()
    if (ts.isJsxExpression(attribute.initializer) && attribute.initializer.expression) return readStaticText(attribute.initializer.expression)
    return ""
  }
}

console.log(JSON.stringify({
  files: files.length,
  staticEnglishCount: staticEnglish.size,
  dynamicPickCount: dynamicPickCalls.length,
  dynamicPickCalls,
  staticEnglish: [...staticEnglish].sort((a, b) => a.localeCompare(b)),
}, null, 2))

function readStaticText(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text.trim()
  return ""
}

function walk(relativeRoot) {
  const absoluteRoot = path.resolve(relativeRoot)
  if (!fs.existsSync(absoluteRoot)) return []
  const output = []
  for (const entry of fs.readdirSync(absoluteRoot, { withFileTypes: true })) {
    const absolute = path.join(absoluteRoot, entry.name)
    if (entry.isDirectory()) output.push(...walk(path.relative(process.cwd(), absolute)))
    else output.push(path.relative(process.cwd(), absolute))
  }
  return output
}
