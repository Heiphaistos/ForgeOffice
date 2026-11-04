// Langages de WinNote absents de @codemirror/language-data : Batch, Makefile, Nim, Zig, Solidity.
import { simpleMode } from '@codemirror/legacy-modes/mode/simple-mode';
import { clike } from '@codemirror/legacy-modes/mode/clike';
import type { StreamParser } from '@codemirror/language';

const words = (list: string): Record<string, boolean> => Object.fromEntries(list.split(' ').map((w) => [w, true]));

export const batch: StreamParser<unknown> = simpleMode({
  start: [
    { regex: /(?:rem\b|::).*$/i, token: 'comment', sol: true },
    { regex: /^\s*@?(?:rem\b|::).*$/i, token: 'comment' },
    { regex: /^\s*:\w+/, token: 'def' },
    { regex: /"(?:[^"\\]|\\.)*"?/, token: 'string' },
    { regex: /%~?[\w:~,-]*%?|![\w]+!/, token: 'variable-2' },
    { regex: /\b(?:if|else|for|in|do|goto|call|exit|not|exist|defined|errorlevel|set|setlocal|endlocal|echo|pause|shift|start|cd|chdir|equ|neq|lss|leq|gtr|geq)\b/i, token: 'keyword' },
    { regex: /\b(?:copy|del|dir|md|rd|move|ren|type|cls|mkdir|rmdir|xcopy|robocopy|taskkill|findstr|choice|timeout|where)\b/i, token: 'builtin' },
    { regex: /\d+/, token: 'number' },
    { regex: /[<>|&=@]/, token: 'operator' },
  ],
  languageData: { commentTokens: { line: 'REM' } },
});

export const makefile: StreamParser<unknown> = simpleMode({
  start: [
    { regex: /#.*$/, token: 'comment' },
    { regex: /^[\w./%-]+(?=\s*:(?!=))/, token: 'def' },
    { regex: /^\s*(?:ifeq|ifneq|ifdef|ifndef|else|endif|include|define|endef|export|override|\.PHONY)\b/, token: 'keyword' },
    { regex: /\$[({][^)}]*[)}]|\$[@<^?*%]/, token: 'variable-2' },
    { regex: /^[\w.-]+(?=\s*[:+?]?=)/, token: 'variable' },
    { regex: /"(?:[^"\\]|\\.)*"?|'[^']*'?/, token: 'string' },
    { regex: /[:+?]?=|[|;]/, token: 'operator' },
  ],
  languageData: { commentTokens: { line: '#' } },
});

export const nim: StreamParser<unknown> = simpleMode({
  start: [
    { regex: /#\[/, token: 'comment', next: 'block' },
    { regex: /#.*$/, token: 'comment' },
    { regex: /"""/, token: 'string', next: 'triple' },
    { regex: /"(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)'/, token: 'string' },
    {
      regex: /\b(?:addr|and|as|asm|bind|block|break|case|cast|concept|const|continue|converter|defer|discard|distinct|div|do|elif|else|end|enum|except|export|finally|for|from|func|if|import|in|include|interface|is|isnot|iterator|let|macro|method|mixin|mod|nil|not|notin|object|of|or|out|proc|ptr|raise|ref|return|shl|shr|static|template|try|tuple|type|using|var|when|while|xor|yield)\b/,
      token: 'keyword',
    },
    { regex: /\b(?:true|false)\b/, token: 'atom' },
    { regex: /\b(?:int|int8|int16|int32|int64|uint|float|float32|float64|bool|char|string|seq|array|set|openArray)\b/, token: 'type' },
    { regex: /0x[\da-f_]+|\d[\d_]*(?:\.\d+)?(?:e[+-]?\d+)?/i, token: 'number' },
    { regex: /[-+*/%=<>!&|^~@$.:]+/, token: 'operator' },
  ],
  block: [{ regex: /.*?\]#/, token: 'comment', next: 'start' }, { regex: /.*/, token: 'comment' }],
  triple: [{ regex: /.*?"""/, token: 'string', next: 'start' }, { regex: /.*/, token: 'string' }],
  languageData: { commentTokens: { line: '#' } },
});

export const zig: StreamParser<unknown> = clike({
  name: 'zig',
  keywords: words('const var fn pub return if else while for switch break continue struct enum union error try catch defer errdefer comptime inline export extern packed opaque orelse and or test usingnamespace async await suspend resume nosuspend threadlocal'),
  types: words('i8 i16 i32 i64 i128 isize u8 u16 u32 u64 u128 usize f16 f32 f64 f128 bool void anyerror anytype type noreturn c_int c_uint'),
  atoms: words('true false null undefined unreachable'),
});

export const solidity: StreamParser<unknown> = clike({
  name: 'solidity',
  keywords: words('pragma solidity import contract interface library is function modifier event emit struct enum mapping public private internal external view pure payable constant immutable override virtual returns return if else for while do break continue new delete try catch revert require assert using memory storage calldata constructor fallback receive'),
  types: words('address bool string bytes byte int uint int256 uint256 uint8 uint16 uint32 uint64 uint128 bytes32 bytes4'),
  atoms: words('true false wei gwei ether seconds minutes hours days weeks'),
});
