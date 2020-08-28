import {
    baseParse, ErrorCodes, Namespaces, NodeTypes, ElementTypes, TextModes,
    TextNode, CommentNode, ElementNode, ParserOptions, Position,
} from '../src';

describe('parse', () => {
    describe('Text', () => {
        test('simple text', () => {
            const ast = baseParse('some text');
            const text = ast.children[0] as TextNode;

            expect(text).toStrictEqual({
                type: NodeTypes.TEXT,
                content: 'some text',
                loc: {
                    start: { offset: 0, line: 1, column: 1 },
                    end: { offset: 9, line: 1, column: 10 },
                    source: 'some text',
                },
            });
        });

        test('simple text with invalid end tag', () => {
            const onError = jest.fn();
            const ast = baseParse('some text</div>', {
                onError,
            });
            const text = ast.children[0] as TextNode;

            expect(onError).toBeCalled();
            expect(text).toStrictEqual({
                type: NodeTypes.TEXT,
                content: 'some text',
                loc: {
                    start: { offset: 0, line: 1, column: 1 },
                    end: { offset: 9, line: 1, column: 10 },
                    source: 'some text',
                },
            });
        });

        test('lonly "<" don\'t separate nodes', () => {
            const ast = baseParse('a < b', {
                onError: (err) => {
                    if (err.code !== ErrorCodes.INVALID_FIRST_CHARACTER_OF_TAG_NAME) {
                        throw err;
                    }
                },
            });
            const text = ast.children[0] as TextNode;

            expect(text).toStrictEqual({
                type: NodeTypes.TEXT,
                content: 'a < b',
                loc: {
                    start: { offset: 0, line: 1, column: 1 },
                    end: { offset: 5, line: 1, column: 6 },
                    source: 'a < b',
                },
            });
        });
    });

    describe('Comment', () => {
        test('empty comment', () => {
            const ast = baseParse('<!---->');
            const comment = ast.children[0] as CommentNode;

            expect(comment).toStrictEqual({
                type: NodeTypes.COMMENT,
                content: '',
                loc: {
                    start: { offset: 0, line: 1, column: 1 },
                    end: { offset: 7, line: 1, column: 8 },
                    source: '<!---->',
                },
            });
        });

        test('simple comment', () => {
            const ast = baseParse('<!--abc-->');
            const comment = ast.children[0] as CommentNode;

            expect(comment).toStrictEqual({
                type: NodeTypes.COMMENT,
                content: 'abc',
                loc: {
                    start: { offset: 0, line: 1, column: 1 },
                    end: { offset: 10, line: 1, column: 11 },
                    source: '<!--abc-->',
                },
            });
        });

        test('two comments', () => {
            const ast = baseParse('<!--abc--><!--def-->');
            const comment1 = ast.children[0] as CommentNode;
            const comment2 = ast.children[1] as CommentNode;

            expect(comment1).toStrictEqual({
                type: NodeTypes.COMMENT,
                content: 'abc',
                loc: {
                    start: { offset: 0, line: 1, column: 1 },
                    end: { offset: 10, line: 1, column: 11 },
                    source: '<!--abc-->',
                },
            });
            expect(comment2).toStrictEqual({
                type: NodeTypes.COMMENT,
                content: 'def',
                loc: {
                    start: { offset: 10, line: 1, column: 11 },
                    end: { offset: 20, line: 1, column: 21 },
                    source: '<!--def-->',
                },
            });
        });
    });

    describe('Element', () => {
        test('simple div', () => {
            const ast = baseParse('<div>hello</div>');
            const element = ast.children[0] as ElementNode;

            expect(element).toStrictEqual({
                type: NodeTypes.ELEMENT,
                ns: Namespaces.HTML,
                tag: 'div',
                tagType: ElementTypes.ELEMENT,
                props: [],
                isSelfClosing: false,
                children: [
                    {
                        type: NodeTypes.TEXT,
                        content: 'hello',
                        loc: {
                            start: { offset: 5, line: 1, column: 6 },
                            end: { offset: 10, line: 1, column: 11 },
                            source: 'hello',
                        },
                    },
                ],
                loc: {
                    start: { offset: 0, line: 1, column: 1 },
                    end: { offset: 16, line: 1, column: 17 },
                    source: '<div>hello</div>',
                },
            });
        });

        test('empty', () => {
            const ast = baseParse('<div></div>');
            const element = ast.children[0] as ElementNode;

            expect(element).toStrictEqual({
                type: NodeTypes.ELEMENT,
                ns: Namespaces.HTML,
                tag: 'div',
                tagType: ElementTypes.ELEMENT,
                props: [],
                isSelfClosing: false,
                children: [],
                loc: {
                    start: { offset: 0, line: 1, column: 1 },
                    end: { offset: 11, line: 1, column: 12 },
                    source: '<div></div>',
                },
            });
        });

        test('self closing', () => {
            const ast = baseParse('<div/>after');
            const element = ast.children[0] as ElementNode;

            expect(element).toStrictEqual({
                type: NodeTypes.ELEMENT,
                ns: Namespaces.HTML,
                tag: 'div',
                tagType: ElementTypes.ELEMENT,
                props: [],
                isSelfClosing: true,
                children: [],
                loc: {
                    start: { offset: 0, line: 1, column: 1 },
                    end: { offset: 6, line: 1, column: 7 },
                    source: '<div/>',
                },
            });
        });

        test('void element', () => {
            const ast = baseParse('<img>after', {
                isVoidTag: (tag) => tag === 'img',
            });
            const element = ast.children[0] as ElementNode;

            expect(element).toStrictEqual({
                type: NodeTypes.ELEMENT,
                ns: Namespaces.HTML,
                tag: 'img',
                tagType: ElementTypes.ELEMENT,
                props: [],
                isSelfClosing: false,
                children: [],
                loc: {
                    start: { offset: 0, line: 1, column: 1 },
                    end: { offset: 5, line: 1, column: 6 },
                    source: '<img>',
                },
            });
        });


        test('attribute with no value', () => {
            const ast = baseParse('<div id></div>');
            const element = ast.children[0] as ElementNode;

            expect(element).toStrictEqual({
                type: NodeTypes.ELEMENT,
                ns: Namespaces.HTML,
                tag: 'div',
                tagType: ElementTypes.ELEMENT,
                props: [
                    {
                        type: NodeTypes.ATTRIBUTE,
                        name: 'id',
                        value: undefined,
                        loc: {
                            start: { offset: 5, line: 1, column: 6 },
                            end: { offset: 7, line: 1, column: 8 },
                            source: 'id',
                        },
                    },
                ],

                isSelfClosing: false,
                children: [],
                loc: {
                    start: { offset: 0, line: 1, column: 1 },
                    end: { offset: 14, line: 1, column: 15 },
                    source: '<div id></div>',
                },
            });
        });

        test('attribute with empty value, double quote', () => {
            const ast = baseParse('<div id=""></div>');
            const element = ast.children[0] as ElementNode;

            expect(element).toStrictEqual({
                type: NodeTypes.ELEMENT,
                ns: Namespaces.HTML,
                tag: 'div',
                tagType: ElementTypes.ELEMENT,
                props: [
                    {
                        type: NodeTypes.ATTRIBUTE,
                        name: 'id',
                        value: {
                            type: NodeTypes.TEXT,
                            content: '',
                            loc: {
                                start: { offset: 8, line: 1, column: 9 },
                                end: { offset: 10, line: 1, column: 11 },
                                source: '""',
                            },
                        },
                        loc: {
                            start: { offset: 5, line: 1, column: 6 },
                            end: { offset: 10, line: 1, column: 11 },
                            source: 'id=""',
                        },
                    },
                ],

                isSelfClosing: false,
                children: [],
                loc: {
                    start: { offset: 0, line: 1, column: 1 },
                    end: { offset: 17, line: 1, column: 18 },
                    source: '<div id=""></div>',
                },
            });
        });

        test('attribute with empty value, single quote', () => {
            const ast = baseParse("<div id=''></div>");
            const element = ast.children[0] as ElementNode;

            expect(element).toStrictEqual({
                type: NodeTypes.ELEMENT,
                ns: Namespaces.HTML,
                tag: 'div',
                tagType: ElementTypes.ELEMENT,
                props: [
                    {
                        type: NodeTypes.ATTRIBUTE,
                        name: 'id',
                        value: {
                            type: NodeTypes.TEXT,
                            content: '',
                            loc: {
                                start: { offset: 8, line: 1, column: 9 },
                                end: { offset: 10, line: 1, column: 11 },
                                source: "''",
                            },
                        },
                        loc: {
                            start: { offset: 5, line: 1, column: 6 },
                            end: { offset: 10, line: 1, column: 11 },
                            source: "id=''",
                        },
                    },
                ],

                isSelfClosing: false,
                children: [],
                loc: {
                    start: { offset: 0, line: 1, column: 1 },
                    end: { offset: 17, line: 1, column: 18 },
                    source: "<div id=''></div>",
                },
            });
        });

        test('attribute with value, double quote', () => {
            const ast = baseParse('<div id=">\'"></div>');
            const element = ast.children[0] as ElementNode;

            expect(element).toStrictEqual({
                type: NodeTypes.ELEMENT,
                ns: Namespaces.HTML,
                tag: 'div',
                tagType: ElementTypes.ELEMENT,
                props: [
                    {
                        type: NodeTypes.ATTRIBUTE,
                        name: 'id',
                        value: {
                            type: NodeTypes.TEXT,
                            content: ">'",
                            loc: {
                                start: { offset: 8, line: 1, column: 9 },
                                end: { offset: 12, line: 1, column: 13 },
                                source: '">\'"',
                            },
                        },
                        loc: {
                            start: { offset: 5, line: 1, column: 6 },
                            end: { offset: 12, line: 1, column: 13 },
                            source: 'id=">\'"',
                        },
                    },
                ],

                isSelfClosing: false,
                children: [],
                loc: {
                    start: { offset: 0, line: 1, column: 1 },
                    end: { offset: 19, line: 1, column: 20 },
                    source: '<div id=">\'"></div>',
                },
            });
        });

        test('attribute with value, single quote', () => {
            const ast = baseParse("<div id='>\"'></div>");
            const element = ast.children[0] as ElementNode;

            expect(element).toStrictEqual({
                type: NodeTypes.ELEMENT,
                ns: Namespaces.HTML,
                tag: 'div',
                tagType: ElementTypes.ELEMENT,
                props: [
                    {
                        type: NodeTypes.ATTRIBUTE,
                        name: 'id',
                        value: {
                            type: NodeTypes.TEXT,
                            content: '>"',
                            loc: {
                                start: { offset: 8, line: 1, column: 9 },
                                end: { offset: 12, line: 1, column: 13 },
                                source: "'>\"'",
                            },
                        },
                        loc: {
                            start: { offset: 5, line: 1, column: 6 },
                            end: { offset: 12, line: 1, column: 13 },
                            source: "id='>\"'",
                        },
                    },
                ],

                isSelfClosing: false,
                children: [],
                loc: {
                    start: { offset: 0, line: 1, column: 1 },
                    end: { offset: 19, line: 1, column: 20 },
                    source: "<div id='>\"'></div>",
                },
            });
        });

        test('attribute with value, unquoted', () => {
            const ast = baseParse('<div id=a/></div>');
            const element = ast.children[0] as ElementNode;

            expect(element).toStrictEqual({
                type: NodeTypes.ELEMENT,
                ns: Namespaces.HTML,
                tag: 'div',
                tagType: ElementTypes.ELEMENT,
                props: [
                    {
                        type: NodeTypes.ATTRIBUTE,
                        name: 'id',
                        value: {
                            type: NodeTypes.TEXT,
                            content: 'a/',
                            loc: {
                                start: { offset: 8, line: 1, column: 9 },
                                end: { offset: 10, line: 1, column: 11 },
                                source: 'a/',
                            },
                        },
                        loc: {
                            start: { offset: 5, line: 1, column: 6 },
                            end: { offset: 10, line: 1, column: 11 },
                            source: 'id=a/',
                        },
                    },
                ],

                isSelfClosing: false,
                children: [],
                loc: {
                    start: { offset: 0, line: 1, column: 1 },
                    end: { offset: 17, line: 1, column: 18 },
                    source: '<div id=a/></div>',
                },
            });
        });

        test('multiple attributes', () => {
            const ast = baseParse('<div id=a class="c" inert style=\'\'></div>');
            const element = ast.children[0] as ElementNode;

            expect(element).toStrictEqual({
                type: NodeTypes.ELEMENT,
                ns: Namespaces.HTML,
                tag: 'div',
                tagType: ElementTypes.ELEMENT,
                props: [
                    {
                        type: NodeTypes.ATTRIBUTE,
                        name: 'id',
                        value: {
                            type: NodeTypes.TEXT,
                            content: 'a',
                            loc: {
                                start: { offset: 8, line: 1, column: 9 },
                                end: { offset: 9, line: 1, column: 10 },
                                source: 'a',
                            },
                        },
                        loc: {
                            start: { offset: 5, line: 1, column: 6 },
                            end: { offset: 9, line: 1, column: 10 },
                            source: 'id=a',
                        },
                    },
                    {
                        type: NodeTypes.ATTRIBUTE,
                        name: 'class',
                        value: {
                            type: NodeTypes.TEXT,
                            content: 'c',
                            loc: {
                                start: { offset: 16, line: 1, column: 17 },
                                end: { offset: 19, line: 1, column: 20 },
                                source: '"c"',
                            },
                        },
                        loc: {
                            start: { offset: 10, line: 1, column: 11 },
                            end: { offset: 19, line: 1, column: 20 },
                            source: 'class="c"',
                        },
                    },
                    {
                        type: NodeTypes.ATTRIBUTE,
                        name: 'inert',
                        value: undefined,
                        loc: {
                            start: { offset: 20, line: 1, column: 21 },
                            end: { offset: 25, line: 1, column: 26 },
                            source: 'inert',
                        },
                    },
                    {
                        type: NodeTypes.ATTRIBUTE,
                        name: 'style',
                        value: {
                            type: NodeTypes.TEXT,
                            content: '',
                            loc: {
                                start: { offset: 32, line: 1, column: 33 },
                                end: { offset: 34, line: 1, column: 35 },
                                source: "''",
                            },
                        },
                        loc: {
                            start: { offset: 26, line: 1, column: 27 },
                            end: { offset: 34, line: 1, column: 35 },
                            source: "style=''",
                        },
                    },
                ],

                isSelfClosing: false,
                children: [],
                loc: {
                    start: { offset: 0, line: 1, column: 1 },
                    end: { offset: 41, line: 1, column: 42 },
                    source: '<div id=a class="c" inert style=\'\'></div>',
                },
            });
        });

        test('end tags are case-insensitive.', () => {
            const ast = baseParse('<div>hello</DIV>after');
            const element = ast.children[0] as ElementNode;
            const text = element.children[0] as TextNode;

            expect(text).toStrictEqual({
                type: NodeTypes.TEXT,
                content: 'hello',
                loc: {
                    start: { offset: 5, line: 1, column: 6 },
                    end: { offset: 10, line: 1, column: 11 },
                    source: 'hello',
                },
            });
        });
    });

    test('invalid html', () => {
        expect(() => {
            baseParse('<div>\n<span>\n</div>\n</span>');
        }).toThrow('Element is missing end tag.');

        const spy = jest.fn();
        const ast = baseParse('<div>\n<span>\n</div>\n</span>', {
            onError: spy,
        });

        expect(spy.mock.calls).toMatchObject([
            [
                {
                    code: ErrorCodes.X_MISSING_END_TAG,
                    loc: {
                        start: {
                            offset: 6,
                            line: 2,
                            column: 1,
                        },
                    },
                },
            ],
            [
                {
                    code: ErrorCodes.X_INVALID_END_TAG,
                    loc: {
                        start: {
                            offset: 20,
                            line: 4,
                            column: 1,
                        },
                    },
                },
            ],
        ]);

        expect(ast).toMatchSnapshot();
    });

    test('parse with correct location info', () => {
        const [foo, bar, but, baz] = baseParse(
            `
foo
 is <div>bar</div> but <span>baz</span>`.trim(),
        ).children;

        let offset = 0;
        expect(foo.loc.start).toEqual({ line: 1, column: 1, offset });
        offset += foo.loc.source.length;
        expect(foo.loc.end).toEqual({ line: 2, column: 5, offset });

        expect(bar.loc.start).toEqual({ line: 2, column: 5, offset });
        const barInner = (bar as ElementNode).children[0];
        offset += 5;
        expect(barInner.loc.start).toEqual({ line: 2, column: 10, offset });
        offset += barInner.loc.source.length;
        expect(barInner.loc.end).toEqual({ line: 2, column: 13, offset });
        offset += 6;
        expect(bar.loc.end).toEqual({ line: 2, column: 19, offset });

        expect(but.loc.start).toEqual({ line: 2, column: 19, offset });
        offset += but.loc.source.length;
        expect(but.loc.end).toEqual({ line: 2, column: 24, offset });

        expect(baz.loc.start).toEqual({ line: 2, column: 24, offset });
        const bazInner = (baz as ElementNode).children[0];
        offset += 6;
        expect(bazInner.loc.start).toEqual({ line: 2, column: 30, offset });
        offset += bazInner.loc.source.length;
        expect(bazInner.loc.end).toEqual({ line: 2, column: 33, offset });
        offset += 7;
        expect(baz.loc.end).toEqual({ line: 2, column: 40, offset });
    });

    describe('decodeEntities option', () => {
        test('use the given map', () => {
            const ast: any = baseParse('&amp;&cups;', {
                decodeEntities: (text) => text.replace('&cups;', '\u222A\uFE00'),
                onError: () => { }, // Ignore errors
            });

            expect(ast.children.length).toBe(1);
            expect(ast.children[0].type).toBe(NodeTypes.TEXT);
            expect(ast.children[0].content).toBe('&amp;\u222A\uFE00');
        });
    });

    describe('whitespace management w/ condense strategy', () => {
        const parse = (content: string) => baseParse(content, {
            whitespace: 'condense',
        });
        it('should remove whitespaces at start/end inside an element', () => {
            const ast = parse('<div>   <span/>    </div>');
            expect((ast.children[0] as ElementNode).children.length).toBe(1);
        });

        it('should remove whitespaces w/ newline between elements', () => {
            const ast = parse('<div/> \n <div/> \n <div/>');
            expect(ast.children.length).toBe(3);
            expect(ast.children.every((c) => c.type === NodeTypes.ELEMENT)).toBe(true);
        });

        it('should remove whitespaces adjacent to comments', () => {
            const ast = parse('<div/> \n <!--foo--> <div/>');
            expect(ast.children.length).toBe(3);
            expect(ast.children[0].type).toBe(NodeTypes.ELEMENT);
            expect(ast.children[1].type).toBe(NodeTypes.COMMENT);
            expect(ast.children[2].type).toBe(NodeTypes.ELEMENT);
        });

        it('should remove whitespaces w/ newline between comments and elements', () => {
            const ast = parse('<div/> \n <!--foo--> \n <div/>');
            expect(ast.children.length).toBe(3);
            expect(ast.children[0].type).toBe(NodeTypes.ELEMENT);
            expect(ast.children[1].type).toBe(NodeTypes.COMMENT);
            expect(ast.children[2].type).toBe(NodeTypes.ELEMENT);
        });

        it('should NOT remove whitespaces w/o newline between elements', () => {
            const ast = parse('<div/> <div/> <div/>');
            expect(ast.children.length).toBe(5);
            expect(ast.children.map((c) => c.type)).toMatchObject([
                NodeTypes.ELEMENT,
                NodeTypes.TEXT,
                NodeTypes.ELEMENT,
                NodeTypes.TEXT,
                NodeTypes.ELEMENT,
            ]);
        });

        it('should condense consecutive whitespaces in text', () => {
            const ast = parse('   foo  \n    bar     baz     ');
            expect((ast.children[0] as TextNode).content).toBe(' foo bar baz ');
        });
    });

    describe('whitespace management w/ preserve strategy', () => {
        const parse = (content: string) => baseParse(content, {
            whitespace: 'preserve',
        });
        it('should NOT remove whitespaces at start/end inside an element', () => {
            const ast = parse('<div>   <span/>    </div>');
            expect((ast.children[0] as ElementNode).children.length).toBe(3);
        });

        it('should NOT remove whitespaces w/ newline between elements', () => {
            const ast = parse('<div/> \n <div/> \n <div/>');
            expect(ast.children.length).toBe(5);
            expect(ast.children.map((c) => c.type)).toMatchObject([
                NodeTypes.ELEMENT,
                NodeTypes.TEXT,
                NodeTypes.ELEMENT,
                NodeTypes.TEXT,
                NodeTypes.ELEMENT,
            ]);
        });

        it('should NOT remove whitespaces adjacent to comments', () => {
            const ast = parse('<div/> \n <!--foo--> <div/>');
            expect(ast.children.length).toBe(5);
            expect(ast.children[0].type).toBe(NodeTypes.ELEMENT);
            expect(ast.children[1].type).toBe(NodeTypes.TEXT);
            expect(ast.children[2].type).toBe(NodeTypes.COMMENT);
            expect(ast.children[3].type).toBe(NodeTypes.TEXT);
            expect(ast.children[4].type).toBe(NodeTypes.ELEMENT);
        });

        it('should NOT remove whitespaces w/ newline between comments and elements', () => {
            const ast = parse('<div/> \n <!--foo--> \n <div/>');
            expect(ast.children.length).toBe(5);
            expect(ast.children[0].type).toBe(NodeTypes.ELEMENT);
            expect(ast.children[1].type).toBe(NodeTypes.TEXT);
            expect(ast.children[2].type).toBe(NodeTypes.COMMENT);
            expect(ast.children[3].type).toBe(NodeTypes.TEXT);
            expect(ast.children[4].type).toBe(NodeTypes.ELEMENT);
        });

        it('should NOT remove whitespaces w/o newline between elements', () => {
            const ast = parse('<div/> <div/> <div/>');
            expect(ast.children.length).toBe(5);
            expect(ast.children.map((c) => c.type)).toMatchObject([
                NodeTypes.ELEMENT,
                NodeTypes.TEXT,
                NodeTypes.ELEMENT,
                NodeTypes.TEXT,
                NodeTypes.ELEMENT,
            ]);
        });

        it('should NOT condense consecutive whitespaces in text', () => {
            const ast = parse('   foo  \n    bar     baz     ');
            expect((ast.children[0] as TextNode).content).toBe('   foo  \n    bar     baz     ');
        });
    });

    describe('Errors', () => {
        const patterns: {
            [key: string]: Array<{
                code: string
                errors: Array<{ type: ErrorCodes; loc: Position }>
                options?: Partial<ParserOptions>
            }>
        } = {
            ABRUPT_CLOSING_OF_EMPTY_COMMENT: [
                {
                    code: '<template><!--></template>',
                    errors: [
                        {
                            type: ErrorCodes.ABRUPT_CLOSING_OF_EMPTY_COMMENT,
                            loc: { offset: 10, line: 1, column: 11 },
                        },
                    ],
                },
                {
                    code: '<template><!---></template>',
                    errors: [
                        {
                            type: ErrorCodes.ABRUPT_CLOSING_OF_EMPTY_COMMENT,
                            loc: { offset: 10, line: 1, column: 11 },
                        },
                    ],
                },
                {
                    code: '<template><!----></template>',
                    errors: [],
                },
            ],
            CDATA_IN_HTML_CONTENT: [
                {
                    code: '<template><![CDATA[cdata]]></template>',
                    errors: [
                        {
                            type: ErrorCodes.CDATA_IN_HTML_CONTENT,
                            loc: { offset: 10, line: 1, column: 11 },
                        },
                    ],
                },
                {
                    code: '<template><svg><![CDATA[cdata]]></svg></template>',
                    errors: [],
                },
            ],
            DUPLICATE_ATTRIBUTE: [
                {
                    code: '<template><div id="" id=""></div></template>',
                    errors: [
                        {
                            type: ErrorCodes.DUPLICATE_ATTRIBUTE,
                            loc: { offset: 21, line: 1, column: 22 },
                        },
                    ],
                },
            ],
            END_TAG_WITH_ATTRIBUTES: [
                {
                    code: '<template><div></div id=""></template>',
                    errors: [
                        {
                            type: ErrorCodes.END_TAG_WITH_ATTRIBUTES,
                            loc: { offset: 21, line: 1, column: 22 },
                        },
                    ],
                },
            ],
            END_TAG_WITH_TRAILING_SOLIDUS: [
                {
                    code: '<template><div></div/></template>',
                    errors: [
                        {
                            type: ErrorCodes.END_TAG_WITH_TRAILING_SOLIDUS,
                            loc: { offset: 20, line: 1, column: 21 },
                        },
                    ],
                },
            ],
            EOF_BEFORE_TAG_NAME: [
                {
                    code: '<template><',
                    errors: [
                        {
                            type: ErrorCodes.EOF_BEFORE_TAG_NAME,
                            loc: { offset: 11, line: 1, column: 12 },
                        },
                        {
                            type: ErrorCodes.X_MISSING_END_TAG,
                            loc: { offset: 0, line: 1, column: 1 },
                        },
                    ],
                },
                {
                    code: '<template></',
                    errors: [
                        {
                            type: ErrorCodes.EOF_BEFORE_TAG_NAME,
                            loc: { offset: 12, line: 1, column: 13 },
                        },
                        {
                            type: ErrorCodes.X_MISSING_END_TAG,
                            loc: { offset: 0, line: 1, column: 1 },
                        },
                    ],
                },
            ],
            EOF_IN_CDATA: [
                {
                    code: '<template><svg><![CDATA[cdata',
                    errors: [
                        {
                            type: ErrorCodes.EOF_IN_CDATA,
                            loc: { offset: 29, line: 1, column: 30 },
                        },
                        {
                            type: ErrorCodes.X_MISSING_END_TAG,
                            loc: { offset: 10, line: 1, column: 11 },
                        },
                        {
                            type: ErrorCodes.X_MISSING_END_TAG,
                            loc: { offset: 0, line: 1, column: 1 },
                        },
                    ],
                },
                {
                    code: '<template><svg><![CDATA[',
                    errors: [
                        {
                            type: ErrorCodes.EOF_IN_CDATA,
                            loc: { offset: 24, line: 1, column: 25 },
                        },
                        {
                            type: ErrorCodes.X_MISSING_END_TAG,
                            loc: { offset: 10, line: 1, column: 11 },
                        },
                        {
                            type: ErrorCodes.X_MISSING_END_TAG,
                            loc: { offset: 0, line: 1, column: 1 },
                        },
                    ],
                },
            ],
            EOF_IN_COMMENT: [
                {
                    code: '<template><!--comment',
                    errors: [
                        {
                            type: ErrorCodes.EOF_IN_COMMENT,
                            loc: { offset: 21, line: 1, column: 22 },
                        },
                        {
                            type: ErrorCodes.X_MISSING_END_TAG,
                            loc: { offset: 0, line: 1, column: 1 },
                        },
                    ],
                },
                {
                    code: '<template><!--',
                    errors: [
                        {
                            type: ErrorCodes.EOF_IN_COMMENT,
                            loc: { offset: 14, line: 1, column: 15 },
                        },
                        {
                            type: ErrorCodes.X_MISSING_END_TAG,
                            loc: { offset: 0, line: 1, column: 1 },
                        },
                    ],
                },
                // Bogus comments don't throw eof-in-comment error.
                // https://html.spec.whatwg.org/multipage/parsing.html#bogus-comment-state
                {
                    code: '<template><!',
                    errors: [
                        {
                            type: ErrorCodes.INCORRECTLY_OPENED_COMMENT,
                            loc: { offset: 10, line: 1, column: 11 },
                        },
                        {
                            type: ErrorCodes.X_MISSING_END_TAG,
                            loc: { offset: 0, line: 1, column: 1 },
                        },
                    ],
                },
                {
                    code: '<template><!-',
                    errors: [
                        {
                            type: ErrorCodes.INCORRECTLY_OPENED_COMMENT,
                            loc: { offset: 10, line: 1, column: 11 },
                        },
                        {
                            type: ErrorCodes.X_MISSING_END_TAG,
                            loc: { offset: 0, line: 1, column: 1 },
                        },
                    ],
                },
                {
                    code: '<template><!abc',
                    errors: [
                        {
                            type: ErrorCodes.INCORRECTLY_OPENED_COMMENT,
                            loc: { offset: 10, line: 1, column: 11 },
                        },
                        {
                            type: ErrorCodes.X_MISSING_END_TAG,
                            loc: { offset: 0, line: 1, column: 1 },
                        },
                    ],
                },
            ],
            EOF_IN_SCRIPT_HTML_COMMENT_LIKE_TEXT: [
                {
                    code: "<script><!--console.log('hello')",
                    errors: [
                        {
                            type: ErrorCodes.X_MISSING_END_TAG,
                            loc: { offset: 0, line: 1, column: 1 },
                        },
                        {
                            type: ErrorCodes.EOF_IN_SCRIPT_HTML_COMMENT_LIKE_TEXT,
                            loc: { offset: 32, line: 1, column: 33 },
                        },
                    ],
                },
                {
                    code: "<script>console.log('hello')",
                    errors: [
                        {
                            type: ErrorCodes.X_MISSING_END_TAG,
                            loc: { offset: 0, line: 1, column: 1 },
                        },
                    ],
                },
            ],
            EOF_IN_TAG: [
                {
                    code: '<template><div',
                    errors: [
                        {
                            type: ErrorCodes.EOF_IN_TAG,
                            loc: { offset: 14, line: 1, column: 15 },
                        },
                        {
                            type: ErrorCodes.X_MISSING_END_TAG,
                            loc: { offset: 10, line: 1, column: 11 },
                        },
                        {
                            type: ErrorCodes.X_MISSING_END_TAG,
                            loc: { offset: 0, line: 1, column: 1 },
                        },
                    ],
                },
                {
                    code: '<template><div ',
                    errors: [
                        {
                            type: ErrorCodes.EOF_IN_TAG,
                            loc: { offset: 15, line: 1, column: 16 },
                        },
                        {
                            type: ErrorCodes.X_MISSING_END_TAG,
                            loc: { offset: 10, line: 1, column: 11 },
                        },
                        {
                            type: ErrorCodes.X_MISSING_END_TAG,
                            loc: { offset: 0, line: 1, column: 1 },
                        },
                    ],
                },
                {
                    code: '<template><div id',
                    errors: [
                        {
                            type: ErrorCodes.EOF_IN_TAG,
                            loc: { offset: 17, line: 1, column: 18 },
                        },
                        {
                            type: ErrorCodes.X_MISSING_END_TAG,
                            loc: { offset: 10, line: 1, column: 11 },
                        },
                        {
                            type: ErrorCodes.X_MISSING_END_TAG,
                            loc: { offset: 0, line: 1, column: 1 },
                        },
                    ],
                },
                {
                    code: '<template><div id ',
                    errors: [
                        {
                            type: ErrorCodes.EOF_IN_TAG,
                            loc: { offset: 18, line: 1, column: 19 },
                        },
                        {
                            type: ErrorCodes.X_MISSING_END_TAG,
                            loc: { offset: 10, line: 1, column: 11 },
                        },
                        {
                            type: ErrorCodes.X_MISSING_END_TAG,
                            loc: { offset: 0, line: 1, column: 1 },
                        },
                    ],
                },
                {
                    code: '<template><div id =',
                    errors: [
                        {
                            type: ErrorCodes.MISSING_ATTRIBUTE_VALUE,
                            loc: { offset: 19, line: 1, column: 20 },
                        },
                        {
                            type: ErrorCodes.EOF_IN_TAG,
                            loc: { offset: 19, line: 1, column: 20 },
                        },
                        {
                            type: ErrorCodes.X_MISSING_END_TAG,
                            loc: { offset: 10, line: 1, column: 11 },
                        },
                        {
                            type: ErrorCodes.X_MISSING_END_TAG,
                            loc: { offset: 0, line: 1, column: 1 },
                        },
                    ],
                },
                {
                    code: "<template><div id='abc",
                    errors: [
                        {
                            type: ErrorCodes.EOF_IN_TAG,
                            loc: { offset: 22, line: 1, column: 23 },
                        },
                        {
                            type: ErrorCodes.X_MISSING_END_TAG,
                            loc: { offset: 10, line: 1, column: 11 },
                        },
                        {
                            type: ErrorCodes.X_MISSING_END_TAG,
                            loc: { offset: 0, line: 1, column: 1 },
                        },
                    ],
                },
                {
                    code: '<template><div id="abc',
                    errors: [
                        {
                            type: ErrorCodes.EOF_IN_TAG,
                            loc: { offset: 22, line: 1, column: 23 },
                        },
                        {
                            type: ErrorCodes.X_MISSING_END_TAG,
                            loc: { offset: 10, line: 1, column: 11 },
                        },
                        {
                            type: ErrorCodes.X_MISSING_END_TAG,
                            loc: { offset: 0, line: 1, column: 1 },
                        },
                    ],
                },
                {
                    code: "<template><div id='abc'",
                    errors: [
                        {
                            type: ErrorCodes.EOF_IN_TAG,
                            loc: { offset: 23, line: 1, column: 24 },
                        },
                        {
                            type: ErrorCodes.X_MISSING_END_TAG,
                            loc: { offset: 10, line: 1, column: 11 },
                        },
                        {
                            type: ErrorCodes.X_MISSING_END_TAG,
                            loc: { offset: 0, line: 1, column: 1 },
                        },
                    ],
                },
                {
                    code: '<template><div id="abc"',
                    errors: [
                        {
                            type: ErrorCodes.EOF_IN_TAG,
                            loc: { offset: 23, line: 1, column: 24 },
                        },
                        {
                            type: ErrorCodes.X_MISSING_END_TAG,
                            loc: { offset: 10, line: 1, column: 11 },
                        },
                        {
                            type: ErrorCodes.X_MISSING_END_TAG,
                            loc: { offset: 0, line: 1, column: 1 },
                        },
                    ],
                },
                {
                    code: '<template><div id=abc',
                    errors: [
                        {
                            type: ErrorCodes.EOF_IN_TAG,
                            loc: { offset: 21, line: 1, column: 22 },
                        },
                        {
                            type: ErrorCodes.X_MISSING_END_TAG,
                            loc: { offset: 10, line: 1, column: 11 },
                        },
                        {
                            type: ErrorCodes.X_MISSING_END_TAG,
                            loc: { offset: 0, line: 1, column: 1 },
                        },
                    ],
                },
                {
                    code: "<template><div id='abc'/",
                    errors: [
                        {
                            type: ErrorCodes.UNEXPECTED_SOLIDUS_IN_TAG,
                            loc: { offset: 23, line: 1, column: 24 },
                        },
                        {
                            type: ErrorCodes.EOF_IN_TAG,
                            loc: { offset: 24, line: 1, column: 25 },
                        },
                        {
                            type: ErrorCodes.X_MISSING_END_TAG,
                            loc: { offset: 10, line: 1, column: 11 },
                        },
                        {
                            type: ErrorCodes.X_MISSING_END_TAG,
                            loc: { offset: 0, line: 1, column: 1 },
                        },
                    ],
                },
                {
                    code: '<template><div id="abc"/',
                    errors: [
                        {
                            type: ErrorCodes.UNEXPECTED_SOLIDUS_IN_TAG,
                            loc: { offset: 23, line: 1, column: 24 },
                        },
                        {
                            type: ErrorCodes.EOF_IN_TAG,
                            loc: { offset: 24, line: 1, column: 25 },
                        },
                        {
                            type: ErrorCodes.X_MISSING_END_TAG,
                            loc: { offset: 10, line: 1, column: 11 },
                        },
                        {
                            type: ErrorCodes.X_MISSING_END_TAG,
                            loc: { offset: 0, line: 1, column: 1 },
                        },
                    ],
                },
                {
                    code: '<template><div id=abc /',
                    errors: [
                        {
                            type: ErrorCodes.UNEXPECTED_SOLIDUS_IN_TAG,
                            loc: { offset: 22, line: 1, column: 23 },
                        },
                        {
                            type: ErrorCodes.EOF_IN_TAG,
                            loc: { offset: 23, line: 1, column: 24 },
                        },
                        {
                            type: ErrorCodes.X_MISSING_END_TAG,
                            loc: { offset: 10, line: 1, column: 11 },
                        },
                        {
                            type: ErrorCodes.X_MISSING_END_TAG,
                            loc: { offset: 0, line: 1, column: 1 },
                        },
                    ],
                },
            ],
            INCORRECTLY_CLOSED_COMMENT: [
                {
                    code: '<template><!--comment--!></template>',
                    errors: [
                        {
                            type: ErrorCodes.INCORRECTLY_CLOSED_COMMENT,
                            loc: { offset: 10, line: 1, column: 11 },
                        },
                    ],
                },
            ],
            INCORRECTLY_OPENED_COMMENT: [
                {
                    code: '<template><!></template>',
                    errors: [
                        {
                            type: ErrorCodes.INCORRECTLY_OPENED_COMMENT,
                            loc: { offset: 10, line: 1, column: 11 },
                        },
                    ],
                },
                {
                    code: '<template><!-></template>',
                    errors: [
                        {
                            type: ErrorCodes.INCORRECTLY_OPENED_COMMENT,
                            loc: { offset: 10, line: 1, column: 11 },
                        },
                    ],
                },
                {
                    code: '<template><!ELEMENT br EMPTY></template>',
                    errors: [
                        {
                            type: ErrorCodes.INCORRECTLY_OPENED_COMMENT,
                            loc: { offset: 10, line: 1, column: 11 },
                        },
                    ],
                },
                // Just ignore doctype.
                {
                    code: '<!DOCTYPE html>',
                    errors: [],
                },
            ],
            INVALID_FIRST_CHARACTER_OF_TAG_NAME: [
                {
                    code: '<template>a < b</template>',
                    errors: [
                        {
                            type: ErrorCodes.INVALID_FIRST_CHARACTER_OF_TAG_NAME,
                            loc: { offset: 13, line: 1, column: 14 },
                        },
                    ],
                },
                {
                    code: '<template><�></template>',
                    errors: [
                        {
                            type: ErrorCodes.INVALID_FIRST_CHARACTER_OF_TAG_NAME,
                            loc: { offset: 11, line: 1, column: 12 },
                        },
                    ],
                },
                {
                    code: '<template>a </ b</template>',
                    errors: [
                        {
                            type: ErrorCodes.INVALID_FIRST_CHARACTER_OF_TAG_NAME,
                            loc: { offset: 14, line: 1, column: 15 },
                        },
                        {
                            type: ErrorCodes.X_MISSING_END_TAG,
                            loc: { offset: 0, line: 1, column: 1 },
                        },
                    ],
                },
                {
                    code: '<template></�></template>',
                    errors: [
                        {
                            type: ErrorCodes.INVALID_FIRST_CHARACTER_OF_TAG_NAME,
                            loc: { offset: 12, line: 1, column: 13 },
                        },
                    ],
                },
            ],
            MISSING_ATTRIBUTE_VALUE: [
                {
                    code: '<template><div id=></div></template>',
                    errors: [
                        {
                            type: ErrorCodes.MISSING_ATTRIBUTE_VALUE,
                            loc: { offset: 18, line: 1, column: 19 },
                        },
                    ],
                },
                {
                    code: '<template><div id= ></div></template>',
                    errors: [
                        {
                            type: ErrorCodes.MISSING_ATTRIBUTE_VALUE,
                            loc: { offset: 19, line: 1, column: 20 },
                        },
                    ],
                },
                {
                    code: '<template><div id= /></div></template>',
                    errors: [],
                },
            ],
            MISSING_END_TAG_NAME: [
                {
                    code: '<template></></template>',
                    errors: [
                        {
                            type: ErrorCodes.MISSING_END_TAG_NAME,
                            loc: { offset: 12, line: 1, column: 13 },
                        },
                    ],
                },
            ],
            MISSING_WHITESPACE_BETWEEN_ATTRIBUTES: [
                {
                    code: '<template><div id="foo"class="bar"></div></template>',
                    errors: [
                        {
                            type: ErrorCodes.MISSING_WHITESPACE_BETWEEN_ATTRIBUTES,
                            loc: { offset: 23, line: 1, column: 24 },
                        },
                    ],
                },
                // CR doesn't appear in tokenization phase, but all CR are removed in preprocessing.
                // https://html.spec.whatwg.org/multipage/parsing.html#preprocessing-the-input-stream
                {
                    code: '<template><div id="foo"\r\nclass="bar"></div></template>',
                    errors: [],
                },
            ],
            NESTED_COMMENT: [
                {
                    code: '<template><!--a<!--b--></template>',
                    errors: [
                        {
                            type: ErrorCodes.NESTED_COMMENT,
                            loc: { offset: 15, line: 1, column: 16 },
                        },
                    ],
                },
                {
                    code: '<template><!--a<!--b<!--c--></template>',
                    errors: [
                        {
                            type: ErrorCodes.NESTED_COMMENT,
                            loc: { offset: 15, line: 1, column: 16 },
                        },
                        {
                            type: ErrorCodes.NESTED_COMMENT,
                            loc: { offset: 20, line: 1, column: 21 },
                        },
                    ],
                },
                {
                    code: '<template><!--a<!--></template>',
                    errors: [],
                },
                {
                    code: '<template><!--a<!--',
                    errors: [
                        {
                            type: ErrorCodes.EOF_IN_COMMENT,
                            loc: { offset: 19, line: 1, column: 20 },
                        },
                        {
                            type: ErrorCodes.X_MISSING_END_TAG,
                            loc: { offset: 0, line: 1, column: 1 },
                        },
                    ],
                },
            ],
            UNEXPECTED_CHARACTER_IN_ATTRIBUTE_NAME: [
                {
                    code: "<template><div a\"bc=''></div></template>",
                    errors: [
                        {
                            type: ErrorCodes.UNEXPECTED_CHARACTER_IN_ATTRIBUTE_NAME,
                            loc: { offset: 16, line: 1, column: 17 },
                        },
                    ],
                },
                {
                    code: "<template><div a'bc=''></div></template>",
                    errors: [
                        {
                            type: ErrorCodes.UNEXPECTED_CHARACTER_IN_ATTRIBUTE_NAME,
                            loc: { offset: 16, line: 1, column: 17 },
                        },
                    ],
                },
                {
                    code: "<template><div a<bc=''></div></template>",
                    errors: [
                        {
                            type: ErrorCodes.UNEXPECTED_CHARACTER_IN_ATTRIBUTE_NAME,
                            loc: { offset: 16, line: 1, column: 17 },
                        },
                    ],
                },
            ],
            UNEXPECTED_CHARACTER_IN_UNQUOTED_ATTRIBUTE_VALUE: [
                {
                    code: '<template><div foo=bar"></div></template>',
                    errors: [
                        {
                            type: ErrorCodes.UNEXPECTED_CHARACTER_IN_UNQUOTED_ATTRIBUTE_VALUE,
                            loc: { offset: 22, line: 1, column: 23 },
                        },
                    ],
                },
                {
                    code: "<template><div foo=bar'></div></template>",
                    errors: [
                        {
                            type: ErrorCodes.UNEXPECTED_CHARACTER_IN_UNQUOTED_ATTRIBUTE_VALUE,
                            loc: { offset: 22, line: 1, column: 23 },
                        },
                    ],
                },
                {
                    code: '<template><div foo=bar<div></div></template>',
                    errors: [
                        {
                            type: ErrorCodes.UNEXPECTED_CHARACTER_IN_UNQUOTED_ATTRIBUTE_VALUE,
                            loc: { offset: 22, line: 1, column: 23 },
                        },
                    ],
                },
                {
                    code: '<template><div foo=bar=baz></div></template>',
                    errors: [
                        {
                            type: ErrorCodes.UNEXPECTED_CHARACTER_IN_UNQUOTED_ATTRIBUTE_VALUE,
                            loc: { offset: 22, line: 1, column: 23 },
                        },
                    ],
                },
                {
                    code: '<template><div foo=bar`></div></template>',
                    errors: [
                        {
                            type: ErrorCodes.UNEXPECTED_CHARACTER_IN_UNQUOTED_ATTRIBUTE_VALUE,
                            loc: { offset: 22, line: 1, column: 23 },
                        },
                    ],
                },
            ],
            UNEXPECTED_EQUALS_SIGN_BEFORE_ATTRIBUTE_NAME: [
                {
                    code: '<template><div =foo=bar></div></template>',
                    errors: [
                        {
                            type: ErrorCodes.UNEXPECTED_EQUALS_SIGN_BEFORE_ATTRIBUTE_NAME,
                            loc: { offset: 15, line: 1, column: 16 },
                        },
                    ],
                },
                {
                    code: '<template><div =></div></template>',
                    errors: [
                        {
                            type: ErrorCodes.UNEXPECTED_EQUALS_SIGN_BEFORE_ATTRIBUTE_NAME,
                            loc: { offset: 15, line: 1, column: 16 },
                        },
                    ],
                },
            ],
            UNEXPECTED_QUESTION_MARK_INSTEAD_OF_TAG_NAME: [
                {
                    code: '<template><?xml?></template>',
                    errors: [
                        {
                            type: ErrorCodes.UNEXPECTED_QUESTION_MARK_INSTEAD_OF_TAG_NAME,
                            loc: { offset: 11, line: 1, column: 12 },
                        },
                    ],
                },
            ],
            UNEXPECTED_SOLIDUS_IN_TAG: [
                {
                    code: '<template><div a/b></div></template>',
                    errors: [
                        {
                            type: ErrorCodes.UNEXPECTED_SOLIDUS_IN_TAG,
                            loc: { offset: 16, line: 1, column: 17 },
                        },
                    ],
                },
            ],
            X_INVALID_END_TAG: [
                {
                    code: '<template></div></template>',
                    errors: [
                        {
                            type: ErrorCodes.X_INVALID_END_TAG,
                            loc: { offset: 10, line: 1, column: 11 },
                        },
                    ],
                },
                {
                    code: '<template></div></div></template>',
                    errors: [
                        {
                            type: ErrorCodes.X_INVALID_END_TAG,
                            loc: { offset: 10, line: 1, column: 11 },
                        },
                        {
                            type: ErrorCodes.X_INVALID_END_TAG,
                            loc: { offset: 16, line: 1, column: 17 },
                        },
                    ],
                },
                {
                    code: '<textarea></div></textarea>',
                    errors: [],
                },
                {
                    code: '<svg><![CDATA[</div>]]></svg>',
                    errors: [],
                },
                {
                    code: '<svg><!--</div>--></svg>',
                    errors: [],
                },
            ],
            X_MISSING_END_TAG: [
                {
                    code: '<template><div></template>',
                    errors: [
                        {
                            type: ErrorCodes.X_MISSING_END_TAG,
                            loc: { offset: 10, line: 1, column: 11 },
                        },
                    ],
                },
                {
                    code: '<template><div>',
                    errors: [
                        {
                            type: ErrorCodes.X_MISSING_END_TAG,
                            loc: { offset: 10, line: 1, column: 11 },
                        },
                        {
                            type: ErrorCodes.X_MISSING_END_TAG,
                            loc: { offset: 0, line: 1, column: 1 },
                        },
                    ],
                },
            ],
        };

        // eslint-disable-next-line no-restricted-syntax
        for (const key of Object.keys(patterns) as (keyof (typeof patterns))[]) {
            describe(key, () => {
                // eslint-disable-next-line no-restricted-syntax
                for (const { code, errors, options } of patterns[key]) {
                    test(
                        code.replace(
                            /[\r\n]/g,
                            (c) => `\\x0${c.codePointAt(0)!.toString(16)};`,
                        ),
                        // eslint-disable-next-line no-loop-func
                        () => {
                            const spy = jest.fn();
                            const ast = baseParse(code, {
                                getNamespace: (tag, parent) => {
                                    const ns = parent ? parent.ns : Namespaces.HTML;
                                    if (ns === Namespaces.HTML) {
                                        if (tag === 'svg') {
                                            return (Namespaces.HTML + 1) as any;
                                        }
                                    }
                                    return ns;
                                },
                                getTextMode: ({ tag }) => {
                                    if (tag === 'textarea') {
                                        return TextModes.RCDATA;
                                    }
                                    if (tag === 'script') {
                                        return TextModes.RAWTEXT;
                                    }
                                    return TextModes.DATA;
                                },
                                ...options,
                                onError: spy,
                            });

                            expect(
                                spy.mock.calls.map(([err]) => ({
                                    type: err.code,
                                    loc: err.loc.start,
                                })),
                            ).toMatchObject(errors);
                            expect(ast).toMatchSnapshot();
                        },
                    );
                }
            });
        }
    });
});
