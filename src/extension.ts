import * as vscode from "vscode";

const tokenTypes = new Map<string, number>;
const tokenMods = new Map<string, number>;
const legend = (function () {
  const tokenTypesLegend: string[] = [
    'variable', 'operator'
  ];
  tokenTypesLegend.forEach((tokenType, i) => tokenTypes.set(tokenType, i));

  const tokenModsLegend: string[] = [];
  tokenModsLegend.forEach((tokenMod, i) => tokenMods.set(tokenMod, i));

  return new vscode.SemanticTokensLegend(tokenTypesLegend, tokenModsLegend);
})();

export function activate(ctx: vscode.ExtensionContext) {
  const completionItemProvider = vscode.languages.registerCompletionItemProvider({ scheme: 'file', language: 'pyrlang' }, new CompletionItemProvider(), '\n');
  ctx.subscriptions.push(completionItemProvider);
  const documentSemanticTokensProvider = vscode.languages.registerDocumentSemanticTokensProvider({ scheme: 'file', language: 'pyrlang' }, new DocumentSemanticTokensProvider(), legend);
  ctx.subscriptions.push(documentSemanticTokensProvider);
}

class CompletionItemProvider implements vscode.CompletionItemProvider {
  provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem>> {
    const if_ = new vscode.CompletionItem('if');
    if_.insertText = new vscode.SnippetString('if ${1:condition}:\n\t${2:body}');
    const else_ = new vscode.CompletionItem('else');
    else_.insertText = new vscode.SnippetString('else:\n\t${1:body}');
    const while_ = new vscode.CompletionItem('while');
    while_.insertText = new vscode.SnippetString('while ${1:condition}:\n\t${2:body}');
    const print = new vscode.CompletionItem('print');
    print.insertText = new vscode.SnippetString('print ${1:value}');

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

  private _parseText(text: string): IToken[] {
    const out: IToken[] = [];
    const lines = text.split(/\r\n|\r|\n/);
    
    let inString = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let column = 0;
      let currentWord = '';
      do {
        currentWord += line[column];
        column++;

        let tokenType: string | undefined;

        switch (currentWord) {
          case 'if':
          case 'else':
          case 'while':
          case 'print':
          case 'true':
          case 'false':
            currentWord = '';
            break;

          default:
              if (!inString && currentWord.length > 0 && /[a-zA-Z_][a-zA-Z0-9_]*/.test(currentWord) && (column > line.length - 1 || !/[a-zA-Z_][a-zA-Z0-9_]*/.test(line[column]))) {
                tokenType = 'variable';
                break;
            }
          break;
        }

        if (currentWord.startsWith('"')) {
          inString = true;
          if (currentWord.length > 1 && currentWord.endsWith('"')) {
            inString = false;
            tokenType = undefined;
          }
        }

        if (tokenType !== undefined) {
          out.push({
            line: i,
            startCharacter: column - currentWord.length,
            length: currentWord.length,
            tokenType: tokenType!,
            tokenModifiers: []
          });
          currentWord = '';
        }

        if (/[ \t]/.test(line[column]) && !inString) {
          currentWord = '';
          column++;
        }
      } while (column < line.length);
    }

    return out;
  }
}
