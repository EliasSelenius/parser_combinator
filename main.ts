


type State = {
    input: string,
    index: number,
    result: any,
    isError: boolean
}

type stateTransformFunc = (state: State) => State;

const updateParserState = (state: State, index: number, result: any) : State => {
    return {
        ...state,
        index,
        result
    };
}

const updateParserError = (state: State, msg: string) : State => {
    return {
        ...state,
        isError: true
    };
}

const updateParserResult = (state: State, res: any) : State => {
    return {
        ...state,
        result: res
    };
}

class Parser {
    constructor (public stf: stateTransformFunc) { }

    public run(input: string): State {
        const initialState: State = {
            input: input,
            index: 0,
            result: null,
            isError: false
        };
    
        return this.stf(initialState);
    }

    public map(fn: (res: any) => any) {
        return new Parser(state => {
            const nextState = this.stf(state);
            if (nextState.isError) return nextState;
            return updateParserResult(nextState, fn(nextState.result));
        })
    }

    public chain(fn: (res: any) => Parser) {
        return new Parser(state => {
            const nextState = this.stf(state);
            if (nextState.isError) return nextState;
            return fn(nextState.result).stf(nextState);
        })
    }
}


const str = (txt:string) => new Parser((state:State) => {
    if (state.input.slice(state.index).startsWith(txt)) {
        return updateParserState(state, state.index + txt.length, txt);
    }

    return updateParserError(state, 'Error');
});

const sequence = (parsers: Parser[]) => new Parser((state: State) => {
    let nextState = state;
    const results = [];

    for (const p of parsers) {
        nextState = p.stf(nextState);
        results.push(nextState.result);
    }

    return updateParserState(nextState, nextState.index, results);
});


const lettersRegex = /^[A-Za-z]+/;
const digitsRegex = /^[0-9]+/;
const whitespaceRegex = /^\s+/;

const letters = new Parser(state => {
    if (state.isError) return state;

    const s = state.input.slice(state.index);

    const rm = s.match(lettersRegex);
    if (rm) {
        return updateParserState(state, state.index + rm[0].length, rm[0]);
    }

    return updateParserError(state, 'error');
});

const digits = new Parser(state => {
    if (state.isError) return state;

    const s = state.input.slice(state.index);

    const rm = s.match(digitsRegex);
    if (rm) {
        return updateParserState(state, state.index + rm[0].length, rm[0]);
    }

    return updateParserError(state, 'error');
});

const whitespace = new Parser(state => {
    if (state.isError) return state;

    const s = state.input.slice(state.index);

    const rm = s.match(whitespaceRegex);
    if (rm) {
        return updateParserState(state, state.index + rm[0].length, rm[0]);
    }

    return updateParserError(state, 'error');
})

const choice = (parsers: Parser[]) => new Parser(state => {
    if (state.isError) return state;

    for (const p of parsers) {
        const nextState = p.stf(state);
        if (!nextState.isError) return nextState;
    }

    return updateParserError(state, 'error');
});

const many = (parser: Parser) => new Parser(state => {
    if (state.isError) return state;

    const res: any[] = [];
    let nextState = state;
    while (true) {
        const s = parser.stf(nextState);
        if (s.isError) break;
        else res.push(s.result)
        nextState = s;
    }

    return updateParserResult(nextState, res);
});

const many1 = (parser: Parser) => new Parser(state => {
    if (state.isError) return state;

    const res: any[] = [];
    let nextState = state;
    while (true) {
        const s = parser.stf(nextState);
        if (s.isError) break;
        else res.push(s.result)
        nextState = s;
    }

    if (res.length === 0) return updateParserError(nextState, 'error');

    return updateParserResult(nextState, res);
});

const funcBody = sequence([
    str('{'), whitespace, str('}')
]);

const func = sequence([
    str('func'),
    whitespace,
    letters,
    str('()'),
    whitespace,
    funcBody
]).map(res => {
    return {
        type: 'Function',
        name: res[2],
        body: res[5]
    };
})

const p = many(choice([whitespace, func]));

const file = await Deno.readTextFile('test.txt');
console.log(file);


console.log(p.run(file));