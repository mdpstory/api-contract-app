import type { ContractSchema, FieldType } from "@repo/types"

interface ExampleNode {
  type?: FieldType
  required?: boolean
  children: Map<string, ExampleNode>
}

function createExampleNode(): ExampleNode {
  return { children: new Map() }
}

function splitFieldPath(path: string): string[] {
  return path
    .split(".")
    .map((segment) => segment.trim())
    .filter(Boolean)
}

function buildExampleTree(schema: ContractSchema): ExampleNode {
  const root = createExampleNode()

  for (const field of schema.fields) {
    const segments = splitFieldPath(field.name)
    if (segments.length === 0) continue

    let current = root
    for (const segment of segments) {
      let next = current.children.get(segment)
      if (!next) {
        next = createExampleNode()
        current.children.set(segment, next)
      }
      current = next
    }

    current.type = field.type
    current.required = field.required
  }

  return root
}

function nodeToExample(node: ExampleNode): unknown {
  const hasChildren = node.children.size > 0
  const effectiveType: FieldType = hasChildren ? "object" : (node.type ?? "object")

  switch (effectiveType) {
    case "string":
      return "example"
    case "number":
      return 0
    case "boolean":
      return true
    case "array":
      return []
    case "file":
      return "file.bin"
    case "object": {
      const value: Record<string, unknown> = {}
      for (const [name, child] of node.children) {
        value[name] = nodeToExample(child)
      }
      return value
    }
  }
}

export function schemaToExample(schema: ContractSchema): Record<string, unknown> {
  return nodeToExample(buildExampleTree(schema)) as Record<string, unknown>
}

function formatKey(name: string, required?: boolean): string {
  return required === false ? `${name}?:` : `${name}:`
}

function formatNodeType(type?: FieldType): string {
  return type ?? "object"
}

function formatTypedShapeNode(node: ExampleNode, indentLevel = 0): string {
  const hasChildren = node.children.size > 0
  const indent = "  ".repeat(indentLevel)
  const childIndent = "  ".repeat(indentLevel + 1)

  if (!hasChildren) {
    return formatNodeType(node.type)
  }

  const lines = Array.from(node.children.entries()).map(([name, child]) => {
    const value = formatTypedShapeNode(child, indentLevel + 1)
    return `${childIndent}${formatKey(name, child.required)} ${value}`
  })

  if (lines.length === 0) {
    return "{}"
  }

  return `{
${lines.join(",\n")}
${indent}}`
}

export function formatSchemaTypedShape(schema: ContractSchema): string {
  return formatTypedShapeNode(buildExampleTree(schema))
}

function formatComment(type: FieldType | undefined, required: boolean | undefined): string {
  const resolvedType = type ?? "object"
  const resolvedRequired = required === false ? "optional" : "required"

  return `// ${resolvedType}, ${resolvedRequired}`
}

function formatJsoncNode(node: ExampleNode, indentLevel = 0): string {
  const hasChildren = node.children.size > 0
  const indent = "  ".repeat(indentLevel)
  const childIndent = "  ".repeat(indentLevel + 1)

  if (!hasChildren) {
    return JSON.stringify(nodeToExample(node))
  }

  const entries = Array.from(node.children.entries())
  if (entries.length === 0) {
    return "{}"
  }

  const lines = entries.map(([name, child], index) => {
    const isLast = index === entries.length - 1
    const value = formatJsoncNode(child, indentLevel + 1)
    const suffix = isLast ? "" : ","
    const comment = formatComment(child.type, child.required)

    if (child.children.size > 0) {
      return `${childIndent}${JSON.stringify(name)}: ${value}${suffix} ${comment}`
    }

    return `${childIndent}${JSON.stringify(name)}: ${value}${suffix} ${comment}`
  })

  return `{
${lines.join("\n")}
${indent}}`
}

export function formatSchemaJsoncShape(schema: ContractSchema): string {
  return formatJsoncNode(buildExampleTree(schema))
}
