import { Splitter } from '../src';

const SolidTags = ['tex', 'img'];

const splitter = new Splitter({
    isVoidTag: (tag) => ['img'].indexOf(tag) >= 0, // self-closing tag
    isUnsplittableTag: (tag: string) => SolidTags.indexOf(tag) >= 0,
});

const content1 = '<div>如图,在<tex>\\triangle ABC</tex>中,以<tex>C</tex>点为圆心<img src="xx" height="1" width="2"><p>这是段落，段落里还有<span>标</span>签</p></div>';
const content2 = `<div>阅读《精卫填海》选段，回答问题
精卫是一种小鸟，长着花脑袋、白嘴壳、红足爪，形状有点像乌鸦，住在北方的发鸠山上。发鸠山是一座很高很大的山，山上有很多的石子和树枝。精卫鸟经常从发鸠山上衔起一粒小石子，或是一截小树枝，展翅高飞到东海，在波涛汹涌的海面上飞翔，将石子或树枝从高空投下来，想把大海填平。
大海狞笑着嘲讽精卫：“哼，你这小小的鸟儿，就算忙上千年万年万万年，也别想把我填平！”
精卫则在高空坚定地答复大海：“我就是干到世界末日，也要把你填平！”
“你为什么这样恨我呢？”
“因为你夺去我年轻的生命，将来还会有许多年轻的生命被你无故夺去。”
这是怎么回事？精卫的生命是怎样被大海夺去的呢？
原来，精卫的前身叫做女娃，是太阳神炎帝的女儿。有一天，女娃驾着一只小船，到东海云游玩。不幸的是，海上起了恶浪，恶浪把小船打翻，女娃就被淹死了。
女娃死后，她的灵魂就变成了一只小鸟，这只小鸟就叫精卫。为了不让大海再夺去其他无辜的生命，精卫就发誓把大海填平。但是一只小鸟的力量毕竟有限，为了壮大自己的力量，精卫就和海燕结成配偶，繁衍后代，让自己的精神世世代代流传下去，以继续填海的事业，直到把大海填平为止。精卫和海燕生下的孩子，雌的就是精卫，雄的就是海燕。
精卫填海的事惊动了天神。水神共工很佩服精卫的精神，于是就降下洪水，把高原上的泥沙冲进大海，把海水都搅黄了。于是，人们把东海北部发黄的海域叫做“黄海”。
精卫鸟与结成配偶，生下的孩子，雄性的是海燕，雌性的是精卫。</div>`;

describe('split', () => {
    test('basic usage', () => {
        const res = splitter.split(content1, 0, 60);
        expect(res).toBe('<div>如图,在<tex>\\triangle ABC</tex>中,以<tex>C</tex>点为圆心</div>');
    });

    test('unsplittable', () => {
        const t = () => {
            splitter.split(content1, 75, 80);
        };
        expect(t).toThrow(Error('unsplittable: <img src="xx" height="1" width="2">'));
    });

    test('invalid range', () => {
        const spy = jest.spyOn(global.console, 'warn');
        const res = splitter.split(content1, -1, 600);
        expect(spy).toHaveBeenCalledTimes(1);
        expect(res).toBe(content1);
    });

    test('remain part is full', () => {
        const res = splitter.split(content1, 60, 125);
        expect(res).toBe('<div><img src="xx" height="1" width="2"><p>这是段落，段落里还有<span>标</span>签</p></div>');
    });

    test('chunk text node', () => {
        const res = splitter.split(content2, 0, 10);
        expect(res).toBe('<div>阅读《精卫</div>');
    });
});
