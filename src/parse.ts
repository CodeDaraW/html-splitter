/* eslint-disable no-continue */
/* eslint-disable no-cond-assign */
/* eslint-disable @typescript-eslint/no-unused-expressions */
/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable default-case */
/* eslint-disable no-plusplus */
/* eslint-disable no-param-reassign */
/* eslint-disable no-useless-escape */
import {
    ErrorCodes, createCompilerError, CompilerError,
} from './errors';
import {
    Namespaces,
    AttributeNode,
    CommentNode,
    ElementNode,
    ElementTypes,
    NodeTypes,
    Position,
    RootNode,
    SourceLocation,
    TextNode,
    TemplateChildNode,
    createRoot,
    Namespace,
} from './ast';

/* eslint-disable-next-line */
declare var __TEST__: boolean;

function testAssert(condition: boolean, msg?: string) {
    /* istanbul ignore if */
    if (typeof __TEST__ !== 'undefined' && !condition) {
        throw new Error(msg || 'unexpected compiler condition');
    }
}

// advance by mutation without cloning (for performance reasons), since this
// gets called a lot in the parser
function advancePositionWithMutation(
    pos: Position,
    source: string,
    numberOfCharacters: number = source.length,
): Position {
    let linesCount = 0;
    let lastNewLinePos = -1;
    for (let i = 0; i < numberOfCharacters; i++) {
        if (source.charCodeAt(i) === 10 /* newline char code */) {
            linesCount++;
            lastNewLinePos = i;
        }
    }

    pos.offset += numberOfCharacters;
    pos.line += linesCount;
    pos.column = lastNewLinePos === -1 ?
        pos.column + numberOfCharacters :
        numberOfCharacters - lastNewLinePos;

    return pos;
}

export interface ParserOptions {
    /**
     * e.g. native elements that can self-close, e.g. <img>, <br>, <hr>
     */
    isVoidTag?: (tag: string) => boolean
    /**
     * e.g. elements that should preserve whitespace inside, e.g. <pre>
     */
    isPreTag?: (tag: string) => boolean
    /**
     * Separate option for end users to extend the native elements list
     */
    isCustomElement?: (tag: string) => boolean
    /**
     * Get tag namespace
     */
    getNamespace?: (tag: string, parent: ElementNode | undefined) => Namespace;
    /**
     * Get text parsing mode for this element
     */
    getTextMode?: (
        node: ElementNode,
        parent: ElementNode | undefined
    ) => TextModes
    /**
     * Only needed for DOM compilers
     */
    decodeEntities?: (rawText: string, asAttr: boolean) => string
    onError?: (error: CompilerError) => void
    /**
     * Whitespace handling strategy
     */
    whitespace?: 'preserve' | 'condense';
}

type MergedParserOptions = Required<ParserOptions>;

// The default decoder only provides escapes for characters reserved as part of
// the template syntax, and is only used if the custom renderer did not provide
// a platform-specific decoder.
const decodeRE = /&(gt|lt|amp|apos|quot);/g;
const decodeMap: Record<string, string> = {
    gt: '>',
    lt: '<',
    amp: '&',
    apos: "'",
    quot: '"',
};

export const enum TextModes {
    //          | Elements | Entities | End sign              | Inside of
    DATA, //    | ✔        | ✔        | End tags of ancestors |
    RCDATA, //  | ✘        | ✔        | End tag of the parent | <textarea>
    RAWTEXT, // | ✘        | ✘        | End tag of the parent | <style>,<script>
    CDATA,
    ATTRIBUTE_VALUE
}

interface ParserContext {
    options: MergedParserOptions
    readonly originalSource: string
    source: string
    offset: number
    line: number
    column: number
    inPre: boolean // HTML <pre> tag, preserve whitespaces
}

const NO = () => false;
const defaultParserOptions: MergedParserOptions = {
    getNamespace: () => Namespaces.HTML,
    getTextMode: () => TextModes.DATA,
    isVoidTag: NO,
    isPreTag: NO,
    isCustomElement: NO,
    decodeEntities: (rawText: string): string => rawText.replace(decodeRE, (_, p) => decodeMap[p]),
    onError: (error: CompilerError) => { throw error; },
    whitespace: 'preserve',
};

function createParserContext(
    content: string,
    options: ParserOptions,
): ParserContext {
    return {
        options: {
            ...defaultParserOptions,
            ...options,
        },
        column: 1,
        line: 1,
        offset: 0,
        originalSource: content,
        source: content,
        inPre: false,
    };
}

function parseChildren(
    context: ParserContext,
    mode: TextModes,
    ancestors: ElementNode[],
): TemplateChildNode[] {
    const parent = last(ancestors);
    const ns = parent ? parent.ns : Namespaces.HTML;
    const nodes: TemplateChildNode[] = [];

    while (!isEnd(context, mode, ancestors)) {
        testAssert(context.source.length > 0);
        const s = context.source;
        let node: TemplateChildNode | TemplateChildNode[] | undefined;

        if (mode === TextModes.DATA || mode === TextModes.RCDATA) {
            if (mode === TextModes.DATA && s[0] === '<') {
                // https://html.spec.whatwg.org/multipage/parsing.html#tag-open-state
                if (s.length === 1) {
                    emitError(context, ErrorCodes.EOF_BEFORE_TAG_NAME, 1);
                } else if (s[1] === '!') {
                    // https://html.spec.whatwg.org/multipage/parsing.html#markup-declaration-open-state
                    if (startsWith(s, '<!--')) {
                        node = parseComment(context);
                    } else if (startsWith(s, '<!DOCTYPE')) {
                        // Ignore DOCTYPE by a limitation.
                        node = parseBogusComment(context);
                    } else if (startsWith(s, '<![CDATA[')) {
                        if (ns !== Namespaces.HTML) {
                            node = parseCDATA(context, ancestors);
                        } else {
                            emitError(context, ErrorCodes.CDATA_IN_HTML_CONTENT);
                            node = parseBogusComment(context);
                        }
                    } else {
                        emitError(context, ErrorCodes.INCORRECTLY_OPENED_COMMENT);
                        node = parseBogusComment(context);
                    }
                } else if (s[1] === '/') {
                    // https://html.spec.whatwg.org/multipage/parsing.html#end-tag-open-state
                    if (s.length === 2) {
                        emitError(context, ErrorCodes.EOF_BEFORE_TAG_NAME, 2);
                    } else if (s[2] === '>') {
                        emitError(context, ErrorCodes.MISSING_END_TAG_NAME, 2);
                        advanceBy(context, 3);
                        continue;
                    } else if (/[a-z]/i.test(s[2])) {
                        emitError(context, ErrorCodes.X_INVALID_END_TAG);
                        parseTag(context, TagType.End, parent);
                        continue;
                    } else {
                        emitError(
                            context,
                            ErrorCodes.INVALID_FIRST_CHARACTER_OF_TAG_NAME,
                            2,
                        );
                        node = parseBogusComment(context);
                    }
                } else if (/[a-z]/i.test(s[1])) {
                    node = parseElement(context, ancestors);
                } else if (s[1] === '?') {
                    emitError(
                        context,
                        ErrorCodes.UNEXPECTED_QUESTION_MARK_INSTEAD_OF_TAG_NAME,
                        1,
                    );
                    node = parseBogusComment(context);
                } else {
                    emitError(context, ErrorCodes.INVALID_FIRST_CHARACTER_OF_TAG_NAME, 1);
                }
            }
        }
        if (!node) {
            node = parseText(context, mode);
        }

        if (Array.isArray(node)) {
            for (let i = 0; i < node.length; i++) {
                pushNode(nodes, node[i]);
            }
        } else {
            pushNode(nodes, node);
        }
    }

    // Whitespace handling strategy like v2
    // https://github.com/vuejs/vue/blob/dev/flow/compiler.js#L10
    let removedWhitespace = false;
    if (context.options.whitespace === 'condense' && mode !== TextModes.RAWTEXT) {
        if (!context.inPre) {
            for (let i = 0; i < nodes.length; i++) {
                const node = nodes[i];
                if (node.type === NodeTypes.TEXT) {
                    if (!/[^\t\r\n\f ]/.test(node.content)) {
                        const prev = nodes[i - 1];
                        const next = nodes[i + 1];
                        // If:
                        // - the whitespace is the first or last node, or:
                        // - the whitespace is adjacent to a comment, or:
                        // - the whitespace is between two elements AND contains newline
                        // Then the whitespace is ignored.
                        if (
                            !prev ||
                            !next ||
                            prev.type === NodeTypes.COMMENT ||
                            next.type === NodeTypes.COMMENT ||
                            (prev.type === NodeTypes.ELEMENT &&
                                next.type === NodeTypes.ELEMENT &&
                                /[\r\n]/.test(node.content))
                        ) {
                            removedWhitespace = true;
                            nodes[i] = null as any;
                        } else {
                            // Otherwise, condensed consecutive whitespace inside the text down to
                            // a single space
                            node.content = ' ';
                        }
                    } else {
                        node.content = node.content.replace(/[\t\r\n\f ]+/g, ' ');
                    }
                }
            }
        } else if (parent && context.options.isPreTag(parent.tag)) {
            // remove leading newline per html spec
            // https://html.spec.whatwg.org/multipage/grouping-content.html#the-pre-element
            const first = nodes[0];
            if (first && first.type === NodeTypes.TEXT) {
                first.content = first.content.replace(/^\r?\n/, '');
            }
        }
    }

    return removedWhitespace ? nodes.filter(Boolean) : nodes;
}

function pushNode(nodes: TemplateChildNode[], node: TemplateChildNode): void {
    if (node.type === NodeTypes.TEXT) {
        const prev = last(nodes);
        // Merge if both this and the previous node are text and those are
        // consecutive. This happens for cases like "a < b".
        if (
            prev &&
            prev.type === NodeTypes.TEXT &&
            prev.loc.end.offset === node.loc.start.offset
        ) {
            prev.content += node.content;
            prev.loc.end = node.loc.end;
            prev.loc.source += node.loc.source;
            return;
        }
    }

    nodes.push(node);
}

function parseCDATA(
    context: ParserContext,
    ancestors: ElementNode[],
): TemplateChildNode[] {
    testAssert(last(ancestors) == null || last(ancestors)!.ns !== Namespaces.HTML);
    testAssert(startsWith(context.source, '<![CDATA['));

    advanceBy(context, 9);
    const nodes = parseChildren(context, TextModes.CDATA, ancestors);
    if (context.source.length === 0) {
        emitError(context, ErrorCodes.EOF_IN_CDATA);
    } else {
        testAssert(startsWith(context.source, ']]>'));
        advanceBy(context, 3);
    }

    return nodes;
}

function parseComment(context: ParserContext): CommentNode {
    testAssert(startsWith(context.source, '<!--'));

    const start = getCursor(context);
    let content: string;

    // Regular comment.
    const match = /--(\!)?>/.exec(context.source);
    if (!match) {
        content = context.source.slice(4);
        advanceBy(context, context.source.length);
        emitError(context, ErrorCodes.EOF_IN_COMMENT);
    } else {
        if (match.index <= 3) {
            emitError(context, ErrorCodes.ABRUPT_CLOSING_OF_EMPTY_COMMENT);
        }
        if (match[1]) {
            emitError(context, ErrorCodes.INCORRECTLY_CLOSED_COMMENT);
        }
        content = context.source.slice(4, match.index);

        // Advancing with reporting nested comments.
        const s = context.source.slice(0, match.index);
        let prevIndex = 1;
        let nestedIndex = 0;
        while ((nestedIndex = s.indexOf('<!--', prevIndex)) !== -1) {
            advanceBy(context, nestedIndex - prevIndex + 1);
            if (nestedIndex + 4 < s.length) {
                emitError(context, ErrorCodes.NESTED_COMMENT);
            }
            prevIndex = nestedIndex + 1;
        }
        advanceBy(context, match.index + match[0].length - prevIndex + 1);
    }

    return {
        type: NodeTypes.COMMENT,
        content,
        loc: getSelection(context, start),
    };
}

function parseBogusComment(context: ParserContext): CommentNode | undefined {
    testAssert(/^<(?:[\!\?]|\/[^a-z>])/i.test(context.source));

    const start = getCursor(context);
    const contentStart = context.source[1] === '?' ? 1 : 2;
    let content: string;

    const closeIndex = context.source.indexOf('>');
    if (closeIndex === -1) {
        content = context.source.slice(contentStart);
        advanceBy(context, context.source.length);
    } else {
        content = context.source.slice(contentStart, closeIndex);
        advanceBy(context, closeIndex + 1);
    }

    return {
        type: NodeTypes.COMMENT,
        content,
        loc: getSelection(context, start),
    };
}

function parseElement(
    context: ParserContext,
    ancestors: ElementNode[],
): ElementNode | undefined {
    testAssert(/^<[a-z]/i.test(context.source));

    // Start tag.
    const wasInPre = context.inPre;
    const parent = last(ancestors);
    const element = parseTag(context, TagType.Start, parent);
    const isPreBoundary = context.inPre && !wasInPre;

    if (element.isSelfClosing || context.options.isVoidTag(element.tag)) {
        return element;
    }

    // Children.
    ancestors.push(element);
    const mode = context.options.getTextMode(element, parent);
    const children = parseChildren(context, mode, ancestors);
    ancestors.pop();

    element.children = children;

    // End tag.
    if (startsWithEndTagOpen(context.source, element.tag)) {
        parseTag(context, TagType.End, parent);
    } else {
        emitError(context, ErrorCodes.X_MISSING_END_TAG, 0, element.loc.start);
        if (context.source.length === 0 && element.tag.toLowerCase() === 'script') {
            const first = children[0];
            if (first && startsWith(first.loc.source, '<!--')) {
                emitError(context, ErrorCodes.EOF_IN_SCRIPT_HTML_COMMENT_LIKE_TEXT);
            }
        }
    }

    element.loc = getSelection(context, element.loc.start);

    if (isPreBoundary) {
        context.inPre = false;
    }
    return element;
}

const enum TagType {
    Start,
    End
}

/**
 * Parse a tag (E.g. `<div id=a>`) with that type (start tag or end tag).
 */
function parseTag(
    context: ParserContext,
    type: TagType,
    parent: ElementNode | undefined,
): ElementNode {
    testAssert(/^<\/?[a-z]/i.test(context.source));
    testAssert(
        type === (startsWith(context.source, '</') ? TagType.End : TagType.Start),
    );

    // Tag open.
    const start = getCursor(context);
    const match = /^<\/?([a-z][^\t\r\n\f />]*)/i.exec(context.source)!;
    const tag = match[1];
    const ns = context.options.getNamespace(tag, parent);

    advanceBy(context, match[0].length);
    advanceSpaces(context);

    // Attributes.
    const props = parseAttributes(context, type);

    // check <pre> tag
    if (context.options.isPreTag(tag)) {
        context.inPre = true;
    }

    // Tag close.
    let isSelfClosing = false;
    if (context.source.length === 0) {
        emitError(context, ErrorCodes.EOF_IN_TAG);
    } else {
        isSelfClosing = startsWith(context.source, '/>');
        if (type === TagType.End && isSelfClosing) {
            emitError(context, ErrorCodes.END_TAG_WITH_TRAILING_SOLIDUS);
        }
        advanceBy(context, isSelfClosing ? 2 : 1);
    }

    const tagType = ElementTypes.ELEMENT;

    return {
        type: NodeTypes.ELEMENT,
        ns,
        tag,
        tagType,
        props,
        isSelfClosing,
        children: [],
        loc: getSelection(context, start),
    };
}

function parseAttributes(
    context: ParserContext,
    type: TagType,
): (AttributeNode)[] {
    const props: (AttributeNode)[] = [];
    const attributeNames = new Set<string>();
    while (
        context.source.length > 0 &&
        !startsWith(context.source, '>') &&
        !startsWith(context.source, '/>')
    ) {
        if (startsWith(context.source, '/')) {
            emitError(context, ErrorCodes.UNEXPECTED_SOLIDUS_IN_TAG);
            advanceBy(context, 1);
            advanceSpaces(context);
            continue;
        }
        if (type === TagType.End) {
            emitError(context, ErrorCodes.END_TAG_WITH_ATTRIBUTES);
        }

        const attr = parseAttribute(context, attributeNames);
        if (type === TagType.Start) {
            props.push(attr);
        }

        if (/^[^\t\r\n\f />]/.test(context.source)) {
            emitError(context, ErrorCodes.MISSING_WHITESPACE_BETWEEN_ATTRIBUTES);
        }
        advanceSpaces(context);
    }
    return props;
}

function parseAttribute(
    context: ParserContext,
    nameSet: Set<string>,
): AttributeNode {
    testAssert(/^[^\t\r\n\f />]/.test(context.source));

    // Name.
    const start = getCursor(context);
    const match = /^[^\t\r\n\f />][^\t\r\n\f />=]*/.exec(context.source)!;
    const name = match[0];

    if (nameSet.has(name)) {
        emitError(context, ErrorCodes.DUPLICATE_ATTRIBUTE);
    }
    nameSet.add(name);

    if (name[0] === '=') {
        emitError(context, ErrorCodes.UNEXPECTED_EQUALS_SIGN_BEFORE_ATTRIBUTE_NAME);
    }
    {
        const pattern = /["'<]/g;
        let m: RegExpExecArray | null;
        while ((m = pattern.exec(name))) {
            emitError(
                context,
                ErrorCodes.UNEXPECTED_CHARACTER_IN_ATTRIBUTE_NAME,
                m.index,
            );
        }
    }

    advanceBy(context, name.length);

    // Value
    let value: { content: string; isQuoted: boolean; loc: SourceLocation } | undefined;

    if (/^[\t\r\n\f ]*=/.test(context.source)) {
        advanceSpaces(context);
        advanceBy(context, 1);
        advanceSpaces(context);
        value = parseAttributeValue(context);
        if (!value) {
            emitError(context, ErrorCodes.MISSING_ATTRIBUTE_VALUE);
        }
    }
    const loc = getSelection(context, start);

    return {
        type: NodeTypes.ATTRIBUTE,
        name,
        value: value && {
            type: NodeTypes.TEXT,
            content: value.content,
            loc: value.loc,
        },
        loc,
    };
}

function parseAttributeValue(
    context: ParserContext,
):
    | {
        content: string
        isQuoted: boolean
        loc: SourceLocation
    }
    | undefined {
    const start = getCursor(context);
    let content: string;

    const quote = context.source[0];
    const isQuoted = quote === '"' || quote === '\'';
    if (isQuoted) {
        // Quoted value.
        advanceBy(context, 1);

        const endIndex = context.source.indexOf(quote);
        if (endIndex === -1) {
            content = parseTextData(
                context,
                context.source.length,
                TextModes.ATTRIBUTE_VALUE,
            );
        } else {
            content = parseTextData(context, endIndex, TextModes.ATTRIBUTE_VALUE);
            advanceBy(context, 1);
        }
    } else {
        // Unquoted
        const match = /^[^\t\r\n\f >]+/.exec(context.source);
        if (!match) {
            return undefined;
        }
        const unexpectedChars = /["'<=`]/g;
        let m: RegExpExecArray | null;
        while ((m = unexpectedChars.exec(match[0]))) {
            emitError(
                context,
                ErrorCodes.UNEXPECTED_CHARACTER_IN_UNQUOTED_ATTRIBUTE_VALUE,
                m.index,
            );
        }
        content = parseTextData(context, match[0].length, TextModes.ATTRIBUTE_VALUE);
    }

    return { content, isQuoted, loc: getSelection(context, start) };
}

function parseText(context: ParserContext, mode: TextModes): TextNode {
    testAssert(context.source.length > 0);

    const endTokens = ['<'];
    if (mode === TextModes.CDATA) {
        endTokens.push(']]>');
    }

    let endIndex = context.source.length;
    for (let i = 0; i < endTokens.length; i++) {
        const index = context.source.indexOf(endTokens[i], 1);
        if (index !== -1 && endIndex > index) {
            endIndex = index;
        }
    }

    testAssert(endIndex > 0);

    const start = getCursor(context);
    const content = parseTextData(context, endIndex, mode);

    return {
        type: NodeTypes.TEXT,
        content,
        loc: getSelection(context, start),
    };
}

/**
 * Get text data with a given length from the current location.
 * This translates HTML entities in the text data.
 */
function parseTextData(
    context: ParserContext,
    length: number,
    mode: TextModes,
): string {
    const rawText = context.source.slice(0, length);
    advanceBy(context, length);
    if (
        mode === TextModes.RAWTEXT ||
        mode === TextModes.CDATA ||
        rawText.indexOf('&') === -1
    ) {
        return rawText;
    }
    // DATA or RCDATA containing "&"". Entity decoding required.
    return context.options.decodeEntities(
        rawText,
        mode === TextModes.ATTRIBUTE_VALUE,
    );
}

function getCursor(context: ParserContext): Position {
    const { column, line, offset } = context;
    return { column, line, offset };
}

function getSelection(
    context: ParserContext,
    start: Position,
    end?: Position,
): SourceLocation {
    end = end || getCursor(context);
    return {
        start,
        end,
        source: context.originalSource.slice(start.offset, end.offset),
    };
}

function last<T>(xs: T[]): T | undefined {
    return xs[xs.length - 1];
}

function startsWith(source: string, searchString: string): boolean {
    return source.startsWith(searchString);
}

function advanceBy(context: ParserContext, numberOfCharacters: number): void {
    const { source } = context;
    testAssert(numberOfCharacters <= source.length);
    advancePositionWithMutation(context, source, numberOfCharacters);
    context.source = source.slice(numberOfCharacters);
}

function advanceSpaces(context: ParserContext): void {
    const match = /^[\t\r\n\f ]+/.exec(context.source);
    if (match) {
        advanceBy(context, match[0].length);
    }
}

function startsWithEndTagOpen(source: string, tag: string): boolean {
    return (
        startsWith(source, '</') &&
        source.substr(2, tag.length).toLowerCase() === tag.toLowerCase() &&
        /[\t\n\f />]/.test(source[2 + tag.length] || '>')
    );
}

function emitError(
    context: ParserContext,
    code: ErrorCodes,
    offset?: number,
    loc: Position = getCursor(context),
): void {
    if (offset) {
        loc.offset += offset;
        loc.column += offset;
    }
    context.options.onError(
        createCompilerError(code, {
            start: loc,
            end: loc,
            source: '',
        }),
    );
}

function isEnd(
    context: ParserContext,
    mode: TextModes,
    ancestors: ElementNode[],
): boolean {
    const s = context.source;

    switch (mode) {
        case TextModes.DATA:
            if (startsWith(s, '</')) {
                // TODO: probably bad performance
                for (let i = ancestors.length - 1; i >= 0; --i) {
                    if (startsWithEndTagOpen(s, ancestors[i].tag)) {
                        return true;
                    }
                }
            }
            break;

        case TextModes.RCDATA:
        case TextModes.RAWTEXT: {
            const parent = last(ancestors);
            if (parent && startsWithEndTagOpen(s, parent.tag)) {
                return true;
            }
            break;
        }

        case TextModes.CDATA:
            if (startsWith(s, ']]>')) {
                return true;
            }
            break;
    }

    return !s;
}

export function baseParse(
    content: string,
    options: ParserOptions = {},
): RootNode {
    const context = createParserContext(content, options);
    const start = getCursor(context);
    return createRoot(
        parseChildren(context, TextModes.DATA, []),
        getSelection(context, start),
    );
}