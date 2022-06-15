import * as vscode from "vscode";

const tokenTypes = new Map<string, number>;
const tokenMods = new Map<string, number>;
const legend = (function () {
  const tokenTypesLegend: string[] = [
    "function", "parameter"
  ];
  tokenTypesLegend.forEach((tokenType, i) => tokenTypes.set(tokenType, i));

  const tokenModsLegend: string[] = [];
  tokenModsLegend.forEach((tokenMod, i) => tokenMods.set(tokenMod, i));

  return new vscode.SemanticTokensLegend(tokenTypesLegend, tokenModsLegend);
})();

export function activate(ctx: vscode.ExtensionContext) {
  const completionItemProvider =
    vscode.languages.registerCompletionItemProvider(
      { scheme: "file", language: "pyrlang" },
      new CompletionItemProvider()
    );
  ctx.subscriptions.push(completionItemProvider);
  const documentSemanticTokensProvider = vscode.languages.registerDocumentSemanticTokensProvider({ scheme: 'file', language: 'pyrlang' }, new DocumentSemanticTokensProvider(), legend);
  ctx.subscriptions.push(documentSemanticTokensProvider);
}

class CompletionItemProvider implements vscode.CompletionItemProvider {
  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext
  ): vscode.ProviderResult<
    vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem>
  > {
    const if_ = new vscode.CompletionItem("if");
    if_.insertText = new vscode.SnippetString(
      "if ${1:condition}:\n\t${2:body}"
    );
    const else_ = new vscode.CompletionItem("else");
    else_.insertText = new vscode.SnippetString("else:\n\t${1:body}");
    const while_ = new vscode.CompletionItem("while");
    while_.insertText = new vscode.SnippetString(
      "while ${1:condition}:\n\t${2:body}"
    );
    const print = new vscode.CompletionItem("print");
    print.insertText = new vscode.SnippetString("print ${1:value}");

    return [if_, else_, while_, print];
  }
}

interface IToken {
  line: number;
  startCharacter: number;
	length: number;
	tokenType: string;
	tokenModifiers: string[];
}

class DocumentSemanticTokensProvider implements vscode.DocumentSemanticTokensProvider {
  async provideDocumentSemanticTokens(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.SemanticTokens> {
    const allTokens = this._parseText(document.getText());
    const builder = new vscode.SemanticTokensBuilder();
    allTokens.forEach((token) => {
      builder.push(token.line, token.startCharacter, token.length, this._encodeTokenType(token.tokenType), this._encodeTokenModifiers(token.tokenModifiers));
    });
    return builder.build();
  }

  private _encodeTokenType(tokenType: string): number {
    if (tokenTypes.has(tokenType)) return tokenTypes.get(tokenType)!;
    return 0;
  }

  private _encodeTokenModifiers(strTokenMods: string[]): number {
    let result = 0;
		for (const tokenModifier of strTokenMods) {
			if (tokenMods.has(tokenModifier)) {
				result = result | (1 << tokenMods.get(tokenModifier)!);
			}
    }
		return result;
  }

  // TODO: parse params
  private _parseText(text: string): IToken[] {
    const out: IToken[] = [];
    const lines = text.split(/\r\n|\r|\n/);

    let prevLexeme = "";

    function consumeUntil(line: string, columnEnd: number, start: string, end: string): number {
      if (line[columnEnd] === start) {
        do columnEnd++;
        while (columnEnd < line.length && line[columnEnd] !== end);
      }
      return columnEnd;
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let columnStart = 0;
      let columnEnd = 0;
      let indentSize = 0;

      while (indentSize < line.length && /[\t ]/.test(line[indentSize])) indentSize++;
      columnStart = indentSize;

      do {
        while (columnEnd < line.length && line[columnEnd] !== ' ') {
          let newColumnEnd = consumeUntil(line, columnEnd, "\"", "\"");
          if (newColumnEnd > columnEnd) {
            columnEnd = newColumnEnd;
            columnStart = columnEnd;
          }
          newColumnEnd = consumeUntil(line, columnEnd, "#", "");
          if (newColumnEnd > columnEnd) {
            columnEnd = newColumnEnd;
            columnStart = columnEnd;
          }
          columnEnd = consumeUntil(line, columnEnd, "(", ")");
          columnEnd++;
        }

        const lexeme = line.substring(columnStart, columnEnd).replace(/\+|-|\*|\/|=|!|<|>|==|!=|<=|>=|%|\b(and|or)\b|\^|:|#|->|"/, "");
        if (lexeme.length > 0) {
          if (/[a-zA-Z_][a-zA-Z0-9_]*\(.*\)/.test(lexeme)) {
            out.push({
              length: lexeme.indexOf('('),
              line: i,
              startCharacter: columnStart,
              tokenType: "function",
              tokenModifiers: []
            });
          }
        }

        columnEnd++;
        columnStart = columnEnd;
        prevLexeme = lexeme;
      } while (columnEnd < line.length);
    }

    return out;
  }
}
