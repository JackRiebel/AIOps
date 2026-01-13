/**
 * CLI Workflow Parser
 *
 * Parses CLI workflow syntax into an executable AST (Abstract Syntax Tree).
 * Used to convert user-written CLI commands into structured workflow data.
 */

import { CLI_COMMANDS, CLI_KEYWORDS, type CLIPlatform } from './cliGrammar';

// ============================================================================
// AST Node Types
// ============================================================================

export type ASTNodeType =
  | 'program'
  | 'command'
  | 'if'
  | 'loop'
  | 'wait'
  | 'set'
  | 'return'
  | 'comment';

export interface ASTNode {
  type: ASTNodeType;
  line: number;
  children?: ASTNode[];
}

export interface ProgramNode extends ASTNode {
  type: 'program';
  statements: ASTNode[];
}

export interface CommandNode extends ASTNode {
  type: 'command';
  platform: string;
  subcommand: string;
  flags: Record<string, string | boolean>;
  outputVariable?: string;
}

export interface IfNode extends ASTNode {
  type: 'if';
  condition: ConditionExpression;
  thenBlock: ASTNode[];
  elseBlock?: ASTNode[];
  elifBlocks?: Array<{ condition: ConditionExpression; block: ASTNode[] }>;
}

export interface LoopNode extends ASTNode {
  type: 'loop';
  collection: string;
  itemVariable: string;
  block: ASTNode[];
}

export interface WaitNode extends ASTNode {
  type: 'wait';
  duration: number;
  unit: 'seconds' | 'minutes' | 'hours';
}

export interface SetNode extends ASTNode {
  type: 'set';
  variable: string;
  value: string | ConditionExpression;
}

export interface ReturnNode extends ASTNode {
  type: 'return';
  value: string;
}

export interface CommentNode extends ASTNode {
  type: 'comment';
  text: string;
}

// ============================================================================
// Expression Types
// ============================================================================

export interface ConditionExpression {
  type: 'comparison' | 'logical' | 'value' | 'variable';
  operator?: '==' | '!=' | '>' | '<' | '>=' | '<=' | 'and' | 'or' | 'not' | 'contains';
  left?: ConditionExpression | string;
  right?: ConditionExpression | string;
  value?: string | number | boolean;
  variable?: string;
}

// ============================================================================
// Parser Result
// ============================================================================

export interface ParseResult {
  success: boolean;
  ast?: ProgramNode;
  errors: ParseError[];
  warnings: ParseWarning[];
}

export interface ParseError {
  line: number;
  column: number;
  message: string;
}

export interface ParseWarning {
  line: number;
  column: number;
  message: string;
}

// ============================================================================
// Token Types
// ============================================================================

interface Token {
  type: 'keyword' | 'identifier' | 'string' | 'number' | 'operator' | 'flag' | 'variable' | 'newline' | 'eof';
  value: string;
  line: number;
  column: number;
}

// ============================================================================
// Lexer
// ============================================================================

class CLILexer {
  private input: string;
  private pos: number = 0;
  private line: number = 1;
  private column: number = 1;

  constructor(input: string) {
    this.input = input;
  }

  tokenize(): Token[] {
    const tokens: Token[] = [];

    while (this.pos < this.input.length) {
      const char = this.input[this.pos];

      // Skip whitespace (except newlines)
      if (char === ' ' || char === '\t' || char === '\r') {
        this.advance();
        continue;
      }

      // Newline
      if (char === '\n') {
        tokens.push({ type: 'newline', value: '\n', line: this.line, column: this.column });
        this.advance();
        this.line++;
        this.column = 1;
        continue;
      }

      // Comment
      if (char === '#') {
        // Skip to end of line
        while (this.pos < this.input.length && this.input[this.pos] !== '\n') {
          this.advance();
        }
        continue;
      }

      // String
      if (char === '"' || char === "'") {
        tokens.push(this.readString(char));
        continue;
      }

      // Variable ${...}
      if (char === '$' && this.input[this.pos + 1] === '{') {
        tokens.push(this.readVariable());
        continue;
      }

      // Number
      if (/\d/.test(char)) {
        tokens.push(this.readNumber());
        continue;
      }

      // Flag --flag or -f
      if (char === '-' && /[a-zA-Z-]/.test(this.input[this.pos + 1] || '')) {
        tokens.push(this.readFlag());
        continue;
      }

      // Operators
      if ('=!<>&|'.includes(char)) {
        tokens.push(this.readOperator());
        continue;
      }

      // Identifier or keyword
      if (/[a-zA-Z_]/.test(char)) {
        tokens.push(this.readIdentifier());
        continue;
      }

      // Unknown character - skip
      this.advance();
    }

    tokens.push({ type: 'eof', value: '', line: this.line, column: this.column });
    return tokens;
  }

  private advance(): void {
    this.pos++;
    this.column++;
  }

  private readString(quote: string): Token {
    const startLine = this.line;
    const startColumn = this.column;
    this.advance(); // Skip opening quote

    let value = '';
    while (this.pos < this.input.length && this.input[this.pos] !== quote) {
      if (this.input[this.pos] === '\\' && this.pos + 1 < this.input.length) {
        this.advance();
        value += this.input[this.pos];
      } else {
        value += this.input[this.pos];
      }
      this.advance();
    }
    this.advance(); // Skip closing quote

    return { type: 'string', value, line: startLine, column: startColumn };
  }

  private readVariable(): Token {
    const startLine = this.line;
    const startColumn = this.column;
    this.advance(); // Skip $
    this.advance(); // Skip {

    let value = '';
    while (this.pos < this.input.length && this.input[this.pos] !== '}') {
      value += this.input[this.pos];
      this.advance();
    }
    this.advance(); // Skip }

    return { type: 'variable', value, line: startLine, column: startColumn };
  }

  private readNumber(): Token {
    const startLine = this.line;
    const startColumn = this.column;
    let value = '';

    while (this.pos < this.input.length && /[\d.]/.test(this.input[this.pos])) {
      value += this.input[this.pos];
      this.advance();
    }

    // Check for unit suffix (s, m, h)
    if (/[smh]/.test(this.input[this.pos] || '')) {
      value += this.input[this.pos];
      this.advance();
    }

    return { type: 'number', value, line: startLine, column: startColumn };
  }

  private readFlag(): Token {
    const startLine = this.line;
    const startColumn = this.column;
    let value = '';

    while (this.pos < this.input.length && /[-a-zA-Z0-9_]/.test(this.input[this.pos])) {
      value += this.input[this.pos];
      this.advance();
    }

    return { type: 'flag', value, line: startLine, column: startColumn };
  }

  private readOperator(): Token {
    const startLine = this.line;
    const startColumn = this.column;
    let value = this.input[this.pos];
    this.advance();

    // Check for two-character operators
    const twoChar = value + (this.input[this.pos] || '');
    if (['==', '!=', '>=', '<=', '&&', '||'].includes(twoChar)) {
      value = twoChar;
      this.advance();
    }

    return { type: 'operator', value, line: startLine, column: startColumn };
  }

  private readIdentifier(): Token {
    const startLine = this.line;
    const startColumn = this.column;
    let value = '';

    while (this.pos < this.input.length && /[a-zA-Z0-9_-]/.test(this.input[this.pos])) {
      value += this.input[this.pos];
      this.advance();
    }

    const type = CLI_KEYWORDS.includes(value as typeof CLI_KEYWORDS[number]) ? 'keyword' : 'identifier';
    return { type, value, line: startLine, column: startColumn };
  }
}

// ============================================================================
// Parser
// ============================================================================

class CLIParser {
  private tokens: Token[] = [];
  private pos: number = 0;
  private errors: ParseError[] = [];
  private warnings: ParseWarning[] = [];

  parse(input: string): ParseResult {
    const lexer = new CLILexer(input);
    this.tokens = lexer.tokenize();
    this.pos = 0;
    this.errors = [];
    this.warnings = [];

    const statements = this.parseStatements();

    return {
      success: this.errors.length === 0,
      ast: {
        type: 'program',
        line: 1,
        statements,
      },
      errors: this.errors,
      warnings: this.warnings,
    };
  }

  private parseStatements(endKeywords: string[] = []): ASTNode[] {
    const statements: ASTNode[] = [];

    while (!this.isAtEnd()) {
      // Skip newlines
      while (this.check('newline')) {
        this.advance();
      }

      if (this.isAtEnd()) break;

      // Check for end keywords
      if (this.check('keyword') && endKeywords.includes(this.current().value)) {
        break;
      }

      const statement = this.parseStatement();
      if (statement) {
        statements.push(statement);
      }
    }

    return statements;
  }

  private parseStatement(): ASTNode | null {
    const token = this.current();

    if (token.type === 'keyword') {
      switch (token.value) {
        case 'if':
          return this.parseIf();
        case 'loop':
          return this.parseLoop();
        case 'wait':
          return this.parseWait();
        case 'set':
          return this.parseSet();
        case 'return':
          return this.parseReturn();
        default:
          this.error(`Unexpected keyword: ${token.value}`);
          this.advance();
          return null;
      }
    }

    if (token.type === 'identifier') {
      return this.parseCommand();
    }

    if (token.type === 'newline' || token.type === 'eof') {
      return null;
    }

    this.error(`Unexpected token: ${token.value}`);
    this.advance();
    return null;
  }

  private parseCommand(): CommandNode {
    const line = this.current().line;
    const platform = this.consume('identifier', 'Expected platform name').value;

    let subcommand = '';
    if (this.check('identifier')) {
      subcommand = this.advance().value;
    }

    const flags: Record<string, string | boolean> = {};

    // Parse flags
    while (this.check('flag')) {
      const flag = this.advance().value;
      let value: string | boolean = true;

      // Check if flag has a value
      if (!this.check('newline') && !this.check('flag') && !this.check('eof')) {
        if (this.check('string') || this.check('identifier') || this.check('variable') || this.check('number')) {
          value = this.advance().value;
        }
      }

      flags[flag] = value;
    }

    // Validate platform
    if (!CLI_COMMANDS[platform as CLIPlatform]) {
      this.warning(`Unknown platform: ${platform}`, line);
    }

    return {
      type: 'command',
      line,
      platform,
      subcommand,
      flags,
    };
  }

  private parseIf(): IfNode {
    const line = this.current().line;
    this.consume('keyword', 'Expected "if"'); // if

    const condition = this.parseCondition();

    this.consume('keyword', 'Expected "then"'); // then

    const thenBlock = this.parseStatements(['else', 'elif', 'end']);

    let elseBlock: ASTNode[] | undefined;
    const elifBlocks: Array<{ condition: ConditionExpression; block: ASTNode[] }> = [];

    // Handle elif
    while (this.check('keyword') && this.current().value === 'elif') {
      this.advance(); // elif
      const elifCondition = this.parseCondition();
      this.consume('keyword', 'Expected "then"');
      const elifBlock = this.parseStatements(['else', 'elif', 'end']);
      elifBlocks.push({ condition: elifCondition, block: elifBlock });
    }

    // Handle else
    if (this.check('keyword') && this.current().value === 'else') {
      this.advance(); // else
      elseBlock = this.parseStatements(['end']);
    }

    this.consume('keyword', 'Expected "end"'); // end

    return {
      type: 'if',
      line,
      condition,
      thenBlock,
      elifBlocks: elifBlocks.length > 0 ? elifBlocks : undefined,
      elseBlock,
    };
  }

  private parseCondition(): ConditionExpression {
    return this.parseOrExpression();
  }

  private parseOrExpression(): ConditionExpression {
    let left = this.parseAndExpression();

    while (this.check('keyword') && this.current().value === 'or') {
      this.advance();
      const right = this.parseAndExpression();
      left = {
        type: 'logical',
        operator: 'or',
        left,
        right,
      };
    }

    return left;
  }

  private parseAndExpression(): ConditionExpression {
    let left = this.parseComparison();

    while (this.check('keyword') && this.current().value === 'and') {
      this.advance();
      const right = this.parseComparison();
      left = {
        type: 'logical',
        operator: 'and',
        left,
        right,
      };
    }

    return left;
  }

  private parseComparison(): ConditionExpression {
    let left = this.parsePrimary();

    if (this.check('operator')) {
      const op = this.advance().value;
      const right = this.parsePrimary();

      // Map operators
      const opMap: Record<string, ConditionExpression['operator']> = {
        '==': '==',
        '!=': '!=',
        '>': '>',
        '<': '<',
        '>=': '>=',
        '<=': '<=',
      };

      return {
        type: 'comparison',
        operator: opMap[op] || '==',
        left,
        right,
      };
    }

    // Check for 'contains' keyword
    if (this.check('keyword') && this.current().value === 'contains') {
      this.advance();
      const right = this.parsePrimary();
      return {
        type: 'comparison',
        operator: 'contains',
        left,
        right,
      };
    }

    return left;
  }

  private parsePrimary(): ConditionExpression {
    const token = this.current();

    if (token.type === 'string') {
      this.advance();
      return { type: 'value', value: token.value };
    }

    if (token.type === 'number') {
      this.advance();
      const numValue = parseFloat(token.value);
      return { type: 'value', value: isNaN(numValue) ? token.value : numValue };
    }

    if (token.type === 'variable') {
      this.advance();
      return { type: 'variable', variable: token.value };
    }

    if (token.type === 'identifier') {
      this.advance();
      // Check for dotted access (device.status)
      let value = token.value;
      while (this.check('operator') && this.current().value === '.') {
        this.advance();
        if (this.check('identifier')) {
          value += '.' + this.advance().value;
        }
      }
      return { type: 'variable', variable: value };
    }

    if (token.type === 'keyword') {
      if (token.value === 'true') {
        this.advance();
        return { type: 'value', value: true };
      }
      if (token.value === 'false') {
        this.advance();
        return { type: 'value', value: false };
      }
      if (token.value === 'null') {
        this.advance();
        return { type: 'value', value: null as unknown as boolean };
      }
      if (token.value === 'not') {
        this.advance();
        const expr = this.parsePrimary();
        return { type: 'logical', operator: 'not', left: expr };
      }
    }

    // Default
    this.advance();
    return { type: 'value', value: token.value };
  }

  private parseLoop(): LoopNode {
    const line = this.current().line;
    this.consume('keyword', 'Expected "loop"'); // loop

    const collection = this.consume('identifier', 'Expected collection name').value;

    this.consume('keyword', 'Expected "as"'); // as

    const itemVariable = this.consume('identifier', 'Expected item variable name').value;

    const block = this.parseStatements(['end']);

    this.consume('keyword', 'Expected "end"'); // end

    return {
      type: 'loop',
      line,
      collection,
      itemVariable,
      block,
    };
  }

  private parseWait(): WaitNode {
    const line = this.current().line;
    this.consume('keyword', 'Expected "wait"'); // wait

    const durationToken = this.consume('number', 'Expected duration');
    const value = durationToken.value;

    // Parse duration with unit
    const match = value.match(/^(\d+(?:\.\d+)?)(s|m|h)?$/);
    let duration = 0;
    let unit: 'seconds' | 'minutes' | 'hours' = 'seconds';

    if (match) {
      duration = parseFloat(match[1]);
      const unitChar = match[2] || 's';
      unit = unitChar === 'm' ? 'minutes' : unitChar === 'h' ? 'hours' : 'seconds';
    }

    return {
      type: 'wait',
      line,
      duration,
      unit,
    };
  }

  private parseSet(): SetNode {
    const line = this.current().line;
    this.consume('keyword', 'Expected "set"'); // set

    const variable = this.consume('identifier', 'Expected variable name').value;

    this.consume('operator', 'Expected "="'); // =

    // Parse value (could be string, number, variable, or expression)
    let value: string | ConditionExpression;

    if (this.check('string')) {
      value = this.advance().value;
    } else if (this.check('number')) {
      value = this.advance().value;
    } else if (this.check('variable')) {
      value = '${' + this.advance().value + '}';
    } else {
      value = this.parseCondition();
    }

    return {
      type: 'set',
      line,
      variable,
      value,
    };
  }

  private parseReturn(): ReturnNode {
    const line = this.current().line;
    this.consume('keyword', 'Expected "return"'); // return

    let value = '';
    if (this.check('string')) {
      value = this.advance().value;
    } else if (this.check('variable')) {
      value = '${' + this.advance().value + '}';
    } else if (this.check('identifier')) {
      value = this.advance().value;
    }

    return {
      type: 'return',
      line,
      value,
    };
  }

  // Helper methods
  private current(): Token {
    return this.tokens[this.pos] || { type: 'eof', value: '', line: 0, column: 0 };
  }

  private advance(): Token {
    const token = this.current();
    if (!this.isAtEnd()) this.pos++;
    return token;
  }

  private check(type: Token['type']): boolean {
    return this.current().type === type;
  }

  private consume(type: Token['type'], message: string): Token {
    if (this.check(type)) return this.advance();
    this.error(message);
    return this.current();
  }

  private isAtEnd(): boolean {
    return this.current().type === 'eof';
  }

  private error(message: string, line?: number): void {
    const token = this.current();
    this.errors.push({
      line: line || token.line,
      column: token.column,
      message,
    });
  }

  private warning(message: string, line?: number): void {
    const token = this.current();
    this.warnings.push({
      line: line || token.line,
      column: token.column,
      message,
    });
  }
}

// ============================================================================
// Public API
// ============================================================================

export function parseCLI(input: string): ParseResult {
  const parser = new CLIParser();
  return parser.parse(input);
}

/**
 * Convert parsed AST to workflow nodes format for canvas
 */
export function astToWorkflowNodes(ast: ProgramNode): Array<{
  type: string;
  data: Record<string, unknown>;
  position: { x: number; y: number };
}> {
  const nodes: Array<{
    type: string;
    data: Record<string, unknown>;
    position: { x: number; y: number };
  }> = [];

  let yOffset = 100;
  const spacing = 150;

  function processNode(node: ASTNode, depth: number = 0): void {
    const xOffset = 100 + depth * 250;

    switch (node.type) {
      case 'command': {
        const cmd = node as CommandNode;
        nodes.push({
          type: 'action',
          data: {
            label: `${cmd.platform} ${cmd.subcommand}`,
            actionId: `${cmd.platform}.${cmd.subcommand.replace(/-/g, '_')}`,
            platform: cmd.platform,
            params: cmd.flags,
          },
          position: { x: xOffset, y: yOffset },
        });
        yOffset += spacing;
        break;
      }

      case 'if': {
        const ifNode = node as IfNode;
        nodes.push({
          type: 'condition',
          data: {
            label: 'Condition',
            conditionType: 'expression',
            expression: conditionToString(ifNode.condition),
          },
          position: { x: xOffset, y: yOffset },
        });
        yOffset += spacing;

        ifNode.thenBlock.forEach(child => processNode(child, depth + 1));
        ifNode.elseBlock?.forEach(child => processNode(child, depth + 1));
        break;
      }

      case 'loop': {
        const loopNode = node as LoopNode;
        nodes.push({
          type: 'loop',
          data: {
            label: `Loop: ${loopNode.collection}`,
            loopVariable: loopNode.itemVariable,
            collection: loopNode.collection,
          },
          position: { x: xOffset, y: yOffset },
        });
        yOffset += spacing;

        loopNode.block.forEach(child => processNode(child, depth + 1));
        break;
      }

      case 'wait': {
        const waitNode = node as WaitNode;
        nodes.push({
          type: 'delay',
          data: {
            label: `Wait ${waitNode.duration}${waitNode.unit[0]}`,
            duration: waitNode.duration,
            unit: waitNode.unit,
          },
          position: { x: xOffset, y: yOffset },
        });
        yOffset += spacing;
        break;
      }
    }
  }

  ast.statements.forEach(stmt => processNode(stmt));

  return nodes;
}

function conditionToString(condition: ConditionExpression): string {
  switch (condition.type) {
    case 'value':
      return String(condition.value);
    case 'variable':
      return condition.variable || '';
    case 'comparison':
      return `${conditionToString(condition.left as ConditionExpression)} ${condition.operator} ${conditionToString(condition.right as ConditionExpression)}`;
    case 'logical':
      if (condition.operator === 'not') {
        return `not ${conditionToString(condition.left as ConditionExpression)}`;
      }
      return `${conditionToString(condition.left as ConditionExpression)} ${condition.operator} ${conditionToString(condition.right as ConditionExpression)}`;
    default:
      return '';
  }
}

export default parseCLI;
