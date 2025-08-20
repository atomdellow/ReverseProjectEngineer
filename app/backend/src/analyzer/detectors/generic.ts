import * as fs from 'fs';
import * as path from 'path';
import { logger, getFileExtension } from '../../core/utils';

export interface GenericAnalysisResult {
  language: string;
  imports: string[];
  dependencies: string[];
  symbols: string[];
}

export class GenericDetector {
  // Map of file extensions to languages
  private static readonly LANGUAGE_MAP: Record<string, string> = {
    '.java': 'Java',
    '.kt': 'Kotlin',
    '.scala': 'Scala',
    '.go': 'Go',
    '.rs': 'Rust',
    '.cpp': 'C++',
    '.cc': 'C++',
    '.cxx': 'C++',
    '.c': 'C',
    '.h': 'C',
    '.hpp': 'C++',
    '.php': 'PHP',
    '.rb': 'Ruby',
    '.swift': 'Swift',
    '.r': 'R',
    '.m': 'Objective-C',
    '.mm': 'Objective-C++',
    '.dart': 'Dart',
    '.lua': 'Lua',
    '.sh': 'Shell',
    '.bash': 'Bash',
    '.zsh': 'Zsh',
    '.fish': 'Fish',
    '.ps1': 'PowerShell',
    '.bat': 'Batch',
    '.cmd': 'Batch',
    '.sql': 'SQL',
    '.pl': 'Perl',
    '.pm': 'Perl',
    '.yaml': 'YAML',
    '.yml': 'YAML',
    '.json': 'JSON',
    '.xml': 'XML',
    '.html': 'HTML',
    '.htm': 'HTML',
    '.css': 'CSS',
    '.scss': 'SCSS',
    '.sass': 'Sass',
    '.less': 'Less',
    '.md': 'Markdown',
    '.tex': 'LaTeX',
    '.dockerfile': 'Docker',
    '.makefile': 'Makefile',
    '.mk': 'Makefile',
    '.gradle': 'Gradle',
    '.sbt': 'SBT',
    '.pom': 'Maven',
  };

  static isSupported(filePath: string): boolean {
    const ext = getFileExtension(filePath);
    const fileName = path.basename(filePath).toLowerCase();
    
    return (
      this.LANGUAGE_MAP.hasOwnProperty(ext) ||
      fileName === 'dockerfile' ||
      fileName === 'makefile' ||
      fileName.includes('dockerfile')
    );
  }

  static async analyze(filePath: string): Promise<GenericAnalysisResult> {
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      return this.analyzeContent(content, filePath);
    } catch (error) {
      logger.error(`Failed to analyze generic file ${filePath}:`, error);
      return {
        language: this.getLanguage(filePath),
        imports: [],
        dependencies: [],
        symbols: []
      };
    }
  }

  static analyzeContent(content: string, filePath: string): GenericAnalysisResult {
    const language = this.getLanguage(filePath);
    const ext = getFileExtension(filePath);
    
    let result: GenericAnalysisResult = {
      language,
      imports: [],
      dependencies: [],
      symbols: []
    };

    switch (language) {
      case 'Java':
        result = this.analyzeJava(content);
        break;
      case 'Go':
        result = this.analyzeGo(content);
        break;
      case 'PHP':
        result = this.analyzePHP(content);
        break;
      case 'Ruby':
        result = this.analyzeRuby(content);
        break;
      case 'Shell':
      case 'Bash':
        result = this.analyzeShell(content);
        break;
      case 'SQL':
        result = this.analyzeSQL(content);
        break;
      case 'Docker':
        result = this.analyzeDockerfile(content);
        break;
      case 'YAML':
        result = this.analyzeYAML(content, filePath);
        break;
      case 'JSON':
        result = this.analyzeJSON(content, filePath);
        break;
      default:
        result = this.genericAnalysis(content);
        break;
    }

    result.language = language;
    return result;
  }

  private static analyzeJava(content: string): GenericAnalysisResult {
    const imports: string[] = [];
    const symbols: string[] = [];

    // Extract imports
    const importRegex = /import\s+(?:static\s+)?([^;]+);/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1].trim());
    }

    // Extract classes and interfaces
    const classRegex = /(?:public|private|protected)?\s*(?:static|abstract|final)?\s*(?:class|interface|enum)\s+(\w+)/g;
    while ((match = classRegex.exec(content)) !== null) {
      symbols.push(match[1]);
    }

    return {
      language: 'Java',
      imports,
      dependencies: [...new Set(imports.map(imp => imp.split('.')[0]))],
      symbols
    };
  }

  private static analyzeGo(content: string): GenericAnalysisResult {
    const imports: string[] = [];
    const symbols: string[] = [];

    // Extract imports
    const importRegex = /import\s+(?:\(\s*([\s\S]*?)\s*\)|"([^"]+)")/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      if (match[1]) {
        // Multi-line import
        const lines = match[1].split('\n');
        for (const line of lines) {
          const lineMatch = line.trim().match(/"([^"]+)"/);
          if (lineMatch) {
            imports.push(lineMatch[1]);
          }
        }
      } else if (match[2]) {
        // Single import
        imports.push(match[2]);
      }
    }

    // Extract functions and types
    const funcRegex = /func\s+(?:\([^)]*\)\s+)?(\w+)/g;
    while ((match = funcRegex.exec(content)) !== null) {
      symbols.push(match[1]);
    }

    const typeRegex = /type\s+(\w+)\s+(?:struct|interface)/g;
    while ((match = typeRegex.exec(content)) !== null) {
      symbols.push(match[1]);
    }

    return {
      language: 'Go',
      imports,
      dependencies: [...new Set(imports.map(imp => imp.split('/').pop() || imp))],
      symbols
    };
  }

  private static analyzePHP(content: string): GenericAnalysisResult {
    const imports: string[] = [];
    const symbols: string[] = [];

    // Extract use statements
    const useRegex = /use\s+([^;]+);/g;
    let match;
    while ((match = useRegex.exec(content)) !== null) {
      imports.push(match[1].trim());
    }

    // Extract classes and functions
    const classRegex = /(?:abstract|final)?\s*class\s+(\w+)/g;
    while ((match = classRegex.exec(content)) !== null) {
      symbols.push(match[1]);
    }

    const functionRegex = /function\s+(\w+)/g;
    while ((match = functionRegex.exec(content)) !== null) {
      symbols.push(match[1]);
    }

    return {
      language: 'PHP',
      imports,
      dependencies: [...new Set(imports.map(imp => imp.split('\\')[0]))],
      symbols
    };
  }

  private static analyzeRuby(content: string): GenericAnalysisResult {
    const imports: string[] = [];
    const symbols: string[] = [];

    // Extract require statements
    const requireRegex = /require\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = requireRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    // Extract classes and modules
    const classRegex = /class\s+(\w+)/g;
    while ((match = classRegex.exec(content)) !== null) {
      symbols.push(match[1]);
    }

    const moduleRegex = /module\s+(\w+)/g;
    while ((match = moduleRegex.exec(content)) !== null) {
      symbols.push(match[1]);
    }

    return {
      language: 'Ruby',
      imports,
      dependencies: [...new Set(imports)],
      symbols
    };
  }

  private static analyzeShell(content: string): GenericAnalysisResult {
    const imports: string[] = [];
    const symbols: string[] = [];

    // Extract sourced files
    const sourceRegex = /(?:source|\.)[\s]+([^\s]+)/g;
    let match;
    while ((match = sourceRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    // Extract function definitions
    const functionRegex = /(?:function\s+)?(\w+)\s*\(\)/g;
    while ((match = functionRegex.exec(content)) !== null) {
      symbols.push(match[1]);
    }

    return {
      language: 'Shell',
      imports,
      dependencies: [...new Set(imports)],
      symbols
    };
  }

  private static analyzeSQL(content: string): GenericAnalysisResult {
    const symbols: string[] = [];

    // Extract table names from CREATE statements
    const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/gi;
    let match;
    while ((match = createTableRegex.exec(content)) !== null) {
      symbols.push(match[1]);
    }

    // Extract view names
    const createViewRegex = /CREATE\s+VIEW\s+(\w+)/gi;
    while ((match = createViewRegex.exec(content)) !== null) {
      symbols.push(match[1]);
    }

    return {
      language: 'SQL',
      imports: [],
      dependencies: [],
      symbols
    };
  }

  private static analyzeDockerfile(content: string): GenericAnalysisResult {
    const dependencies: string[] = [];

    // Extract FROM images
    const fromRegex = /FROM\s+([^\s]+)/g;
    let match;
    while ((match = fromRegex.exec(content)) !== null) {
      dependencies.push(match[1]);
    }

    return {
      language: 'Docker',
      imports: [],
      dependencies,
      symbols: []
    };
  }

  private static analyzeYAML(content: string, filePath: string): GenericAnalysisResult {
    const dependencies: string[] = [];
    const fileName = path.basename(filePath).toLowerCase();

    // Check for specific YAML file types
    if (fileName.includes('docker-compose') || fileName.includes('compose')) {
      // Extract service images
      const imageRegex = /image:\s*([^\s]+)/g;
      let match;
      while ((match = imageRegex.exec(content)) !== null) {
        dependencies.push(match[1]);
      }
    } else if (fileName.includes('kubernetes') || fileName.includes('k8s')) {
      // Extract Kubernetes images
      const imageRegex = /image:\s*([^\s]+)/g;
      let match;
      while ((match = imageRegex.exec(content)) !== null) {
        dependencies.push(match[1]);
      }
    }

    return {
      language: 'YAML',
      imports: [],
      dependencies,
      symbols: []
    };
  }

  private static analyzeJSON(content: string, filePath: string): GenericAnalysisResult {
    const dependencies: string[] = [];
    const fileName = path.basename(filePath).toLowerCase();

    try {
      const json = JSON.parse(content);

      if (fileName === 'package.json') {
        // Extract npm dependencies
        if (json.dependencies) {
          dependencies.push(...Object.keys(json.dependencies));
        }
        if (json.devDependencies) {
          dependencies.push(...Object.keys(json.devDependencies));
        }
      } else if (fileName === 'composer.json') {
        // Extract PHP dependencies
        if (json.require) {
          dependencies.push(...Object.keys(json.require));
        }
        if (json['require-dev']) {
          dependencies.push(...Object.keys(json['require-dev']));
        }
      }
    } catch (error) {
      logger.warn(`Failed to parse JSON file ${filePath}:`, error.message);
    }

    return {
      language: 'JSON',
      imports: [],
      dependencies,
      symbols: []
    };
  }

  private static genericAnalysis(content: string): GenericAnalysisResult {
    // Very basic analysis for unknown file types
    const symbols: string[] = [];
    
    // Look for function-like patterns
    const functionRegex = /(?:function|def|fun|func)\s+(\w+)/g;
    let match;
    while ((match = functionRegex.exec(content)) !== null) {
      symbols.push(match[1]);
    }

    return {
      language: 'Unknown',
      imports: [],
      dependencies: [],
      symbols
    };
  }

  static getLanguage(filePath: string): string {
    const ext = getFileExtension(filePath);
    const fileName = path.basename(filePath).toLowerCase();

    if (fileName === 'dockerfile' || fileName.includes('dockerfile')) {
      return 'Docker';
    }
    
    if (fileName === 'makefile' || fileName === 'makefile.am') {
      return 'Makefile';
    }

    return this.LANGUAGE_MAP[ext] || 'Unknown';
  }

  static inferRole(filePath: string, content: string): string {
    const fileName = path.basename(filePath, path.extname(filePath)).toLowerCase();
    const pathLower = filePath.toLowerCase();
    const language = this.getLanguage(filePath);

    // Config files
    if (fileName.includes('config') || fileName.includes('settings') || 
        pathLower.includes('config') || language === 'YAML' || language === 'JSON') {
      return 'config';
    }

    // Test files
    if (pathLower.includes('test') || pathLower.includes('spec') || 
        fileName.includes('test') || fileName.includes('spec')) {
      return 'test';
    }

    // Build/deployment files
    if (language === 'Docker' || language === 'Makefile' || 
        fileName.includes('build') || fileName.includes('deploy')) {
      return 'config';
    }

    // Documentation
    if (language === 'Markdown' || fileName.includes('readme') || 
        fileName.includes('doc') || pathLower.includes('doc')) {
      return 'utility';
    }

    return 'unknown';
  }
}