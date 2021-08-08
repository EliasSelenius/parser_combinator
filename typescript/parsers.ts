

export type State = {
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

export class Parser {
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


export const str = (txt:string) => new Parser((state:State) => {
    if (state.isError) return state;

    if (state.input.slice(state.index).startsWith(txt)) {
        return updateParserState(state, state.index + txt.length, txt);
    }

    return updateParserError(state, 'Error');
});

export const sequence = (parsers: Parser[]) => new Parser((state: State) => {
    let nextState = state;
    const results = [];

    for (const p of parsers) {
        nextState = p.stf(nextState);
        results.push(nextState.result);
    }

    return updateParserState(nextState, nextState.index, results);
});




export const regex = (regx: RegExp) => new Parser(state => {
    if (state.isError) return state;
    
    const s = state.input.slice(state.index);
    
    const rm = s.match(regx);
    if (rm) {
        return updateParserState(state, state.index + rm[0].length, rm[0]);
    }
    
    return updateParserError(state, 'error');
});



export const letters = regex(/^[A-Za-z]+/);
export const digits = regex(/^[0-9]+/);
export const whitespace = regex(/^\s+/);
export const newline = regex(/^(\r\n|\n|\r)/);


export const choice = (parsers: Parser[]) => new Parser(state => {
    if (state.isError) return state;

    for (const p of parsers) {
        const nextState = p.stf(state);
        if (!nextState.isError) return nextState;
    }

    return updateParserError(state, 'error');
});

export const many = (parser: Parser) => new Parser(state => {
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

export const many1 = (parser: Parser) => new Parser(state => {
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


export const between = (left: Parser, right: Parser) => (parser: Parser) => sequence([
    left, parser, right
]).map(res => res[1]);

export const inParentheses = between(str('('), str(')'));
export const inSquareBrackets = between(str('['), str(']'));  
export const inCurlyBrackets = between(str('{'), str('}'));
export const inAngleBrackets = between(str('<'), str('>'));