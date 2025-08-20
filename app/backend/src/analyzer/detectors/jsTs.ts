import * as fs from 'fs';
import * as path from 'path';
import { parse, ParserOptions } from '@babel/parser';
import { Artifact } from '../../core/types';
import { logger, getFileExtension } from '../../core/utils';

export interface DetectedImport {
  source: string;
  specifiers: string[];
  type: 'import' | 'require';
}

export interface DetectedExport {
  name: string;
  type: 'default' | 'named' | 'namespace';
}

export interface JSAnalysisResult {
  imports: DetectedImport[];
  exports: DetectedExport[];
  symbols: string[];
  dependencies: string[];
}

export class JSTypeScriptDetector {
  private static readonly SUPPORTED_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'];
  
  static isSupported(filePath: string): boolean {
    const ext = getFileExtension(filePath);
    return this.SUPPORTED_EXTENSIONS.includes(ext);
  }

  static async analyze(filePath: string): Promise<JSAnalysisResult> {
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      return this.analyzeContent(content, filePath);
    } catch (error) {
      logger.error(`Failed to analyze JS/TS file ${filePath}:`, error);
      return { imports: [], exports: [], symbols: [], dependencies: [] };
    }
  }

  static analyzeContent(content: string, filePath: string): JSAnalysisResult {
    const ext = getFileExtension(filePath);
    const isTypeScript = ['.ts', '.tsx'].includes(ext);
    const isJSX = ['.jsx', '.tsx'].includes(ext);

    const parserOptions: ParserOptions = {
      sourceType: 'module',
      allowImportExportEverywhere: true,
      allowReturnOutsideFunction: true,
      plugins: [
        'asyncGenerators',
        'bigInt',
        'classProperties',
        'decorators-legacy',
        'doExpressions',
        'dynamicImport',
        'exportDefaultFrom',
        'exportNamespaceFrom',
        'functionBind',
        'functionSent',
        'importMeta',
        'nullishCoalescingOperator',
        'numericSeparator',
        'objectRestSpread',
        'optionalCatchBinding',
        'optionalChaining',
        'throwExpressions',
        'topLevelAwait',
      ],
    };

    if (isTypeScript) {
      parserOptions.plugins!.push('typescript');
    }

    if (isJSX) {
      parserOptions.plugins!.push('jsx');
    }

    try {
      const ast = parse(content, parserOptions);
      
      const imports: DetectedImport[] = [];
      const exports: DetectedExport[] = [];
      const symbols: string[] = [];

      // Walk through AST nodes
      const walkNode = (node: any) => {
        if (!node || typeof node !== 'object') return;

        switch (node.type) {
          case 'ImportDeclaration':
            imports.push({
              source: node.source.value,
              specifiers: this.extractImportSpecifiers(node),
              type: 'import'
            });
            break;

          case 'CallExpression':
            if (node.callee?.name === 'require' && node.arguments?.[0]?.type === 'StringLiteral') {
              imports.push({
                source: node.arguments[0].value,
                specifiers: [],
                type: 'require'
              });
            }
            break;

          case 'ExportDefaultDeclaration':
            exports.push({
              name: 'default',
              type: 'default'
            });
            break;

          case 'ExportNamedDeclaration':
            if (node.declaration) {
              const exportNames = this.extractDeclarationNames(node.declaration);
              exportNames.forEach(name => {
                exports.push({
                  name,
                  type: 'named'
                });
              });
            }
            if (node.specifiers) {
              node.specifiers.forEach((spec: any) => {
                exports.push({
                  name: spec.exported.name,
                  type: 'named'
                });
              });
            }
            break;

          case 'ExportAllDeclaration':
            exports.push({
              name: '*',
              type: 'namespace'
            });
            break;

          case 'FunctionDeclaration':
          case 'ClassDeclaration':
          case 'VariableDeclaration':
            const names = this.extractDeclarationNames(node);
            symbols.push(...names);
            break;
        }

        // Recursively walk child nodes
        for (const key in node) {
          if (key === 'parent' || key === 'leadingComments' || key === 'trailingComments') continue;
          const child = node[key];
          if (Array.isArray(child)) {
            child.forEach(walkNode);
          } else if (child && typeof child === 'object') {
            walkNode(child);
          }
        }
      };

      walkNode(ast);

      // Extract unique dependencies from imports
      const dependencies = [...new Set(imports.map(imp => imp.source))];

      return {
        imports,
        exports,
        symbols: [...new Set(symbols)],
        dependencies
      };

    } catch (error) {
      logger.warn(`Failed to parse ${filePath} with Babel, falling back to regex:`, error.message);
      return this.fallbackAnalysis(content);
    }
  }

  private static extractImportSpecifiers(node: any): string[] {
    const specifiers: string[] = [];
    
    if (node.specifiers) {
      node.specifiers.forEach((spec: any) => {
        switch (spec.type) {
          case 'ImportDefaultSpecifier':
            specifiers.push(spec.local.name);
            break;
          case 'ImportNamespaceSpecifier':
            specifiers.push(`* as ${spec.local.name}`);
            break;
          case 'ImportSpecifier':
            const imported = spec.imported.name;
            const local = spec.local.name;
            specifiers.push(imported === local ? imported : `${imported} as ${local}`);
            break;
        }
      });
    }

    return specifiers;
  }

  private static extractDeclarationNames(node: any): string[] {
    const names: string[] = [];

    switch (node.type) {
      case 'FunctionDeclaration':
      case 'ClassDeclaration':
        if (node.id?.name) {
          names.push(node.id.name);
        }
        break;

      case 'VariableDeclaration':
        node.declarations?.forEach((decl: any) => {
          if (decl.id?.name) {
            names.push(decl.id.name);
          } else if (decl.id?.type === 'ObjectPattern') {
            this.extractPatternNames(decl.id, names);
          }
        });
        break;
    }

    return names;
  }

  private static extractPatternNames(pattern: any, names: string[]): void {
    if (pattern.type === 'ObjectPattern') {
      pattern.properties?.forEach((prop: any) => {
        if (prop.value?.name) {
          names.push(prop.value.name);
        }
      });
    } else if (pattern.type === 'ArrayPattern') {
      pattern.elements?.forEach((elem: any) => {
        if (elem?.name) {
          names.push(elem.name);
        }
      });
    }
  }

  private static fallbackAnalysis(content: string): JSAnalysisResult {
    const imports: DetectedImport[] = [];
    const exports: DetectedExport[] = [];
    const symbols: string[] = [];

    // Regex patterns for fallback analysis
    const importRegex = /import\s+.*?\s+from\s+['"`](.*?)['"`]/g;
    const requireRegex = /require\s*\(\s*['"`](.*?)['"`]\s*\)/g;
    const exportRegex = /export\s+(?:default\s+)?(?:class|function|const|let|var)\s+(\w+)/g;
    const functionRegex = /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:function|\(.*?\)\s*=>))/g;
    const classRegex = /class\s+(\w+)/g;

    let match;

    // Extract imports
    while ((match = importRegex.exec(content)) !== null) {
      imports.push({
        source: match[1],
        specifiers: [],
        type: 'import'
      });
    }

    // Extract requires
    while ((match = requireRegex.exec(content)) !== null) {
      imports.push({
        source: match[1],
        specifiers: [],
        type: 'require'
      });
    }

    // Extract exports
    while ((match = exportRegex.exec(content)) !== null) {
      exports.push({
        name: match[1],
        type: 'named'
      });
    }

    // Extract functions
    while ((match = functionRegex.exec(content)) !== null) {
      const name = match[1] || match[2];
      if (name) symbols.push(name);
    }

    // Extract classes
    while ((match = classRegex.exec(content)) !== null) {
      symbols.push(match[1]);
    }

    const dependencies = [...new Set(imports.map(imp => imp.source))];

    return {
      imports,
      exports,
      symbols: [...new Set(symbols)],
      dependencies
    };
  }

  static inferRole(filePath: string, content: string): string {
    const fileName = path.basename(filePath, path.extname(filePath)).toLowerCase();
    const pathLower = filePath.toLowerCase();

    // Test files
    if (pathLower.includes('test') || pathLower.includes('spec') || fileName.includes('test') || fileName.includes('spec')) {
      return 'test';
    }

    // Config files
    if (fileName.includes('config') || fileName.includes('settings') || pathLower.includes('config')) {
      return 'config';
    }

    // Controllers
    if (fileName.includes('controller') || pathLower.includes('controller')) {
      return 'controller';
    }

    // Services
    if (fileName.includes('service') || pathLower.includes('service')) {
      return 'service';
    }

    // Models
    if (fileName.includes('model') || pathLower.includes('model')) {
      return 'model';
    }

    // Views/Components
    if (fileName.includes('view') || fileName.includes('component') || pathLower.includes('view') || pathLower.includes('component')) {
      return 'view';
    }

    // Utilities
    if (fileName.includes('util') || fileName.includes('helper') || pathLower.includes('util') || pathLower.includes('helper')) {
      return 'utility';
    }

    // Analyze content for role hints
    if (content.includes('describe(') || content.includes('it(') || content.includes('test(')) {
      return 'test';
    }

    if (content.includes('export default') && (content.includes('function') || content.includes('class'))) {
      return 'component';
    }

    return 'unknown';
  }
}