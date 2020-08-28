import cloneDeep from 'lodash/cloneDeep';
import { baseParse, ParserOptions } from './parse';
import { RootNode, Node, NodeTypes } from './ast';
import { FifoCache } from './cache';

/* eslint-disable no-param-reassign */
/* eslint-disable dot-notation */

interface SplitterOptions extends ParserOptions {
    /**
     * unsplittable tags e.g. img or custom tags
     */
    isUnsplittableTag?: (tag: string) => boolean;
    /**
     * fifo cache limit, default 10
     */
    cacheLimit?: number;
}

export class Splitter {
    private options: SplitterOptions;

    private cache: FifoCache<string, RootNode>;

    constructor(options: SplitterOptions) {
        this.options = options;
        this.cache = new FifoCache(options.cacheLimit);
    }

    private parse(content: string) {
        const cacheResult = this.cache.get(content);
        if (cacheResult) {
            return cloneDeep(cacheResult);
        }
        const parseResult = baseParse(content, this.options);
        this.cache.set(content, parseResult);
        return cloneDeep(parseResult);
    }

    private checkUsage(begin: number, end: number, node: Node) {
        // 完全不在范围内
        if (node.loc.start.offset > end || node.loc.end.offset < begin) {
            return 'drop';
        }
        // 完全在范围内
        if (node.loc.start.offset >= begin && node.loc.end.offset <= end) {
            return 'full';
        }

        // 部分在范围内
        if (this.options.isUnsplittableTag && this.options.isUnsplittableTag(node['tag'])) {
            // 范围后面卡进来了一部分，舍弃掉
            if (begin <= node.loc.start.offset &&
                end >= node.loc.start.offset &&
                end <= node.loc.end.offset
            ) {
                return 'drop';
            }

            // 范围前面卡进来了一部分，上次未处理完的，需要留下
            if (begin >= node.loc.start.offset &&
                begin <= node.loc.end.offset &&
                end >= node.loc.end.offset
            ) {
                return 'full';
            }

            // 不可分解的标签
            throw Error(`unsplittable: ${node.loc.source}`);
        }

        return null;
    }

    split(sourceHTML: string, begin: number, end: number) {
        const rootNode = this.parse(sourceHTML);
        if (rootNode.loc.start.offset > begin || rootNode.loc.end.offset < end) {
            // eslint-disable-next-line no-console
            console.warn(`out of range: ${begin} ~ ${end}`);
            begin = Math.max(rootNode.loc.start.offset, begin);
            end = Math.min(rootNode.loc.end.offset, end);
        }

        const walk = (node: Node, usage?) => {
            if (!node) return;
            node['usage'] = usage || this.checkUsage(begin, end, node);
            (node['children'] || []).forEach((childNode: Node) => {
                walk(childNode, node['usage']);
            });
        };

        walk(rootNode);

        const finalHTMLChars = sourceHTML.split('');
        const shake = (node: Node) => {
            if (node['usage'] === 'drop') {
                finalHTMLChars.splice(
                    node.loc.start.offset,
                    node.loc.end.offset - node.loc.start.offset,
                );
                return;
            }

            if (node.type === NodeTypes.TEXT && node['usage'] !== 'full') {
                const textStart = Math.max(node.loc.start.offset, begin);
                const textEnd = Math.min(node.loc.end.offset, end);

                if (textEnd < node.loc.end.offset) {
                    finalHTMLChars.splice(textEnd, node.loc.end.offset - textEnd);
                }

                if (textStart > node.loc.start.offset) {
                    finalHTMLChars.splice(node.loc.start.offset, textStart - node.loc.start.offset);
                }
            }

            const children = node['children'] || [];
            for (let i = children.length - 1; i >= 0; i -= 1) {
                const child = children[i];
                shake(child);
            }
        };
        shake(rootNode);

        return finalHTMLChars.join('');
    }
}
