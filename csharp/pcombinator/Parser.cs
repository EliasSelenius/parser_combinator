
using System;
using System.Text.RegularExpressions;
using System.Collections.Generic;

namespace pcombinator {

    public record State(string input, int index, dynamic result, bool isError, string errorMsg);
    public delegate State transformStateFunc(State state);

    public class Parser {

        transformStateFunc stf;
        bool isAndUnary = false;
        bool _ignore = false;

        public Parser(transformStateFunc stf) {
            init(stf);
        }

        public Parser() {}

        public void init(transformStateFunc stf) {
            this.stf = stf;
        }

        public void init(Parser parser) {
            this.stf = parser.stf;
        }

        public State run(string input) {
            var state = new State(input, 0, null, false, null);
            return stf(state);
        }

        public Parser map(Func<dynamic, dynamic> func) => new Parser(state => {
            var nextState = this.stf(state);
            if (nextState.isError) return nextState;
            return updateState(nextState, nextState.index, func(nextState.result));
        });

        private static State updateState(State state, int index, dynamic res) => state with {
            index = index,
            result = res
        };

        private static State updateError(State state, string msg) => state with {
            isError = true,
            errorMsg = msg
        };

        //public static Parser operator <(Parser parser, Parser parser2) => null;
        //public static Parser operator >(Parser parser, Parser parser2) => null;

        //public Parser this[int _] => null;


        public static Parser operator ++(Parser parser) => many1(parser);
        public static Parser operator +(Parser parser) => many(parser);
        public static implicit operator Parser(string s) => str(s);

        public static Parser operator &(Parser left, Parser right) => new Parser(state => {
            if (state.isError) return state;

            var results = new List<dynamic>();

            var nextState = state;

            void addResults(Parser p) {
                if (p.isAndUnary) {
                    for (int i = 0; i < nextState.result.Length; i++) results.Add(nextState.result[i]);
                } else if (!p._ignore) results.Add(nextState.result);
            }

            nextState = left.stf(nextState);
            if (nextState.isError) return nextState;
            addResults(left);
            
            nextState = right.stf(nextState);
            if (nextState.isError) return nextState;
            addResults(right);

            return updateState(nextState, nextState.index, results.ToArray());
        }) {
            isAndUnary = true // signifies that this parser is the result of a 'unaray and' operation
        };


        public static Parser operator |(Parser left, Parser right) {
            var p = new Parser();
            p.stf = state => {
                if (state.isError) return state;

                var s = left.stf(state);
                if (!s.isError) {
                    p._ignore = left._ignore; // p inherits the ignore flag from the parser that parses successfully
                    return s;
                } 

                s = right.stf(state);
                if (!s.isError) {
                    p._ignore = right._ignore;
                    return s;
                }

                return updateError(state, "Neither left or right parser passed");
            };
            return p;
        }

        public static Parser operator /(Parser value, Parser seperator) => sepby(seperator)(value);

        public static Parser str(string s) => new Parser(state => {    
            if (state.isError) return state;

            if (state.input.Substring(state.index).StartsWith(s)) {
                return updateState(state, state.index + s.Length, s);
            }

            return updateError(state, $"Did not get expected token {s}");
        });

        public static Parser sequence(params Parser[] parsers) => new Parser(state => {
            if (state.isError) return state;

            var nextState = state;
            var results = new List<dynamic>();

            for (int i = 0; i < parsers.Length; i++) {
                nextState = parsers[i].stf(nextState);
                if (!parsers[i]._ignore) results.Add(nextState.result);
            }

            return updateState(nextState, nextState.index, results.ToArray());
        });

        public static Parser ignore(Parser parser) => new Parser {
            stf = parser.stf,
            isAndUnary = false,
            _ignore = true
        };

        public static Parser optional(Parser parser) => new Parser(state => {
            if (state.isError) return state;

            var nextState = state;
            nextState = parser.stf(nextState);

            if (nextState.isError) return updateState(state, state.index, null);

            return nextState;
        });

        public static Parser regex(string pattern) => new Parser(state => {
            if (state.isError) return state;

            var s = state.input.Substring(state.index);

            var match = Regex.Match(s, pattern);
            if (match.Success) {
                return updateState(state, state.index + match.Length, match.Value);
            }

            return updateError(state, $"Did not get expected token");
        });

        public static readonly Parser letters = regex("^[a-zA-Z]+");
        public static readonly Parser digits = regex("^[0-9]+");
        public static readonly Parser whitespace = regex("^\\s+");
        public static readonly Parser newline = regex("^[\\n\\r]");

        public static Parser many(Parser parser) => new Parser(state => {
            if (state.isError) return state;

            var results = new List<dynamic>();
            var nextState = state;
            while (true) {
                var s = parser.stf(nextState);
                if (s.isError) break;
                if (!parser._ignore) results.Add(s.result);
                nextState = s;
            }

            return updateState(nextState, nextState.index, results.ToArray());
        });

        public static Parser many1(Parser parser) => new Parser(state => {
            if (state.isError) return state;

            var results = new List<dynamic>();
            var nextState = state;
            while (true) {
                var s = parser.stf(nextState);
                if (s.isError) break;
                if (!parser._ignore) results.Add(s.result);
                nextState = s;
            }

            if (results.Count == 0) return updateError(nextState, "many1 error");

            return updateState(nextState, nextState.index, results.ToArray());
        });

        public static Parser choice(params Parser[] parsers) => new Parser(state => {
            if (state.isError) return state;

            for (int i = 0; i < parsers.Length; i++) {
                var nextState = parsers[i].stf(state);
                if (!nextState.isError) return nextState;
            }

            return updateError(state, "choice error");
        });

        public static Func<Parser, Parser> between(Parser left, Parser right) => (Parser center) => sequence(left, center, right).map(r => r[1]);
        public static readonly Func<Parser, Parser> inParentheses = between(str("("), str(")"));
        public static readonly Func<Parser, Parser> inSquareBrackets = between(str("["), str("]"));
        public static readonly Func<Parser, Parser> inCurlyBrackets = between(str("{"), str("}"));
        public static readonly Func<Parser, Parser> inAngleBrackets = between(str("<"), str(">"));

        public static Func<Parser, Parser> sepby(Parser seperator) => (Parser parser) => new Parser(state => {
            if (state.isError) return state;

            var nextState = state;
            var results = new List<dynamic>();

            while (true) {
                var valueState = parser.stf(nextState);
                if (valueState.isError) break;
                results.Add(valueState.result);
                nextState = valueState;

                var seperatorState = seperator.stf(nextState);
                if (seperatorState.isError) break;
                nextState = seperatorState;
            }

            return updateState(nextState, nextState.index, results.ToArray());
        });

        public static Func<Parser, Parser> sepby1(Parser seperator) => (Parser parser) => new Parser(state => {
            if (state.isError) return state;

            var nextState = state;
            var results = new List<dynamic>();

            while (true) {
                var valueState = parser.stf(nextState);
                if (valueState.isError) break;
                results.Add(valueState.result);
                nextState = valueState;

                var seperatorState = seperator.stf(nextState);
                if (seperatorState.isError) break;
                nextState = seperatorState;
            }

            if (results.Count == 0) return updateError(state, "sepby1: unable to capture any results");

            return updateState(nextState, nextState.index, results.ToArray());
        });

        public static readonly Parser comma = str(",");
        public static readonly Parser period = str(".");
        public static readonly Parser colon = str(":");
        public static readonly Parser semicolon = str(";");
        
        public static readonly Parser plus = str("+");
        public static readonly Parser minus = str("-");
        

    }
}