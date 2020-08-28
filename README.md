# HTML Splitter
[![Build Status](https://travis-ci.org/CodeDaraW/html-splitter.svg?branch=master)](https://travis-ci.org/CodeDaraW/html-splitter)
[![Codecov](https://img.shields.io/codecov/c/github/CodeDaraW/html-splitter)](https://codecov.io/gh/CodeDaraW/html-splitter)
[![npm](https://img.shields.io/npm/v/@html-splitter/html-splitter)](https://www.npmjs.com/package/@html-splitter/html-splitter)
[![MIT](https://img.shields.io/npm/l/@html-splitter/html-splitter)](https://github.com/CodeDaraW/html-splitter/blob/master/LICENSE)

在一些场景（例如博客文章缩略内容展示）下，我们需要对一段 HTML 代码进行分片。
但是简单的字符串裁剪后的 HTML 显然不会是合法的 HTML 代码，所以 HTML Splitter 的目标就是为了解决这个问题。

## 安装
``` sh
npm install @html-splitter/html-splitter
```

## 使用
``` typescript
import { Splitter } from '../src';

const splitter = new Splitter({
    isVoidTag: (tag) => ['img'].indexOf(tag) >= 0, // self-closing tag
    isUnsplittableTag: (tag: string) => ['img'].indexOf(tag) >= 0,
});

const content = '<div>如图,在<tex>\\triangle ABC</tex>中,以<tex>C</tex>点为圆心<img src="xx" height="1" width="2"><p>这是段落，段落里还有<span>标</span>签</p></div>';
const res = splitter.split(content, 0, 60); // '<div>如图,在<tex>\\triangle ABC</tex>中,以<tex>C</tex>点为圆心</div>'
```

## API
HTML Parser 是从 [vue-next](https://github.com/vuejs/vue-next/blob/master/packages/compiler-core/src/parse.ts) fork 后修改而来，
所以 `ParserOptions` 可以参考 `@vue/compiler-core` API。

``` typescript
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
```

`SplitterOptions` 在 `ParserOptions` 之上增加了两个配置项：
- `isUnsplittableTag` 判断一个标签是否是可以拆分的
    - 例如 `img` 是无法拆分的，拆分后就会出现两个重复的 `img` 
    - 一些自定义标签内部结构有着特殊含义，必须视作一个整体，这类也无法做拆分
- `cacheLimit` splitter 内部的 parse 做了 FIFO 缓存，优化重复 split 一段 HTML 场景下的速度，该参数控制缓存的 limit，默认为 10
