
import * as parser from './parsers.ts'

const funcBody = parser.sequence([
    parser.str('{'), parser.whitespace, parser.str('}')
]);

const func = parser.sequence([
    parser.str('func'),
    parser.whitespace,
    parser.letters,
    parser.str('()'),
    parser.whitespace,
    funcBody
]).map((res: any[]) => {
    return {
        type: 'Function',
        name: res[2],
        body: res[5]
    };
})

const p = parser.many(parser.choice([parser.whitespace, func]));



const file = await Deno.readTextFile('test.txt');
console.log(file);


console.log(p.run(file));