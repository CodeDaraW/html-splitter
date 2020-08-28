// Vue template is a platform-agnostic superset of HTML (syntax only).
// More namespaces like SVG and MathML are declared by platform specific
// compilers.
export type Namespace = number;

export const enum Namespaces {
    HTML
}

export const enum NodeTypes {
    ROOT,
    ELEMENT,
    TEXT,
    COMMENT,
    ATTRIBUTE,
}

export const enum ElementTypes {
    ELEMENT,
}

export interface Node {
    type: NodeTypes
    loc: SourceLocation
}

// The node's range. The `start` is inclusive and `end` is exclusive.
// [start, end)
export interface SourceLocation {
    start: Position
    end: Position
    source: string
}

export interface Position {
    offset: number // from start of file
    line: number
    column: number
}

export type ParentNode = RootNode | ElementNode;

export type TemplateChildNode =
  | ElementNode
  | TextNode
  | CommentNode;

export interface RootNode extends Node {
    type: NodeTypes.ROOT
    children: TemplateChildNode[]
}

export type ElementNode = PlainElementNode;

export interface BaseElementNode extends Node {
    type: NodeTypes.ELEMENT
    ns: Namespace
    tag: string
    tagType: ElementTypes
    isSelfClosing: boolean
    props: AttributeNode[];
    children: TemplateChildNode[];
}

export interface PlainElementNode extends BaseElementNode {
    tagType: ElementTypes.ELEMENT
}

export interface TextNode extends Node {
    type: NodeTypes.TEXT
    content: string
}

export interface CommentNode extends Node {
    type: NodeTypes.COMMENT
    content: string
}

export interface AttributeNode extends Node {
    type: NodeTypes.ATTRIBUTE
    name: string
    value: TextNode | undefined
}

// Some expressions, e.g. sequence and conditional expressions, are never
// associated with template nodes, so their source locations are just a stub.
// Container types like CompoundExpression also don't need a real location.
export const locStub: SourceLocation = {
    source: '',
    start: { line: 1, column: 1, offset: 0 },
    end: { line: 1, column: 1, offset: 0 },
};

export function createRoot(
    children: TemplateChildNode[],
    loc = locStub,
): RootNode {
    return {
        type: NodeTypes.ROOT,
        children,
        loc,
    };
}
