import * as fs from 'fs';
import * as path from 'path';
import { logger, getFileExtension } from '../../core/utils';

export interface PythonAnalysisResult {
  imports: string[];
  fromImports: { module: string; names: string[] }[];
  functions: string[];
  classes: string[];
  dependencies: string[];
}

export class PythonDetector {
  private static readonly SUPPORTED_EXTENSIONS = ['.py', '.pyw', '.pyi'];
  
  static isSupported(filePath: string): boolean {
    const ext = getFileExtension(filePath);
    return this.SUPPORTED_EXTENSIONS.includes(ext);
  }

  static async analyze(filePath: string): Promise<PythonAnalysisResult> {
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      return this.analyzeContent(content);
    } catch (error) {
      logger.error(`Failed to analyze Python file ${filePath}:`, error);
      return {
        imports: [],
        fromImports: [],
        functions: [],
        classes: [],
        dependencies: []
      };
    }
  }

  static analyzeContent(content: string): PythonAnalysisResult {
    const result: PythonAnalysisResult = {
      imports: [],
      fromImports: [],
      functions: [],
      classes: [],
      dependencies: []
    };

    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip comments and empty lines
      if (trimmedLine.startsWith('#') || !trimmedLine) {
        continue;
      }

      // Extract import statements
      const importMatch = trimmedLine.match(/^import\s+(.+)$/);
      if (importMatch) {
        const imports = importMatch[1].split(',').map(imp => imp.trim());
        result.imports.push(...imports);
        result.dependencies.push(...imports.map(imp => imp.split('.')[0]));
        continue;
      }

      // Extract from imports
      const fromImportMatch = trimmedLine.match(/^from\s+([^\s]+)\s+import\s+(.+)$/);
      if (fromImportMatch) {
        const module = fromImportMatch[1];
        const names = fromImportMatch[2].split(',').map(name => name.trim());
        result.fromImports.push({ module, names });
        result.dependencies.push(module.split('.')[0]);
        continue;
      }

      // Extract function definitions
      const functionMatch = trimmedLine.match(/^def\s+(\w+)/);
      if (functionMatch) {
        result.functions.push(functionMatch[1]);
        continue;
      }

      // Extract class definitions
      const classMatch = trimmedLine.match(/^class\s+(\w+)/);
      if (classMatch) {
        result.classes.push(classMatch[1]);
        continue;
      }
    }

    // Remove duplicates from dependencies
    result.dependencies = [...new Set(result.dependencies)];

    return result;
  }

  static inferRole(filePath: string, content: string): string {
    const fileName = path.basename(filePath, path.extname(filePath)).toLowerCase();
    const pathLower = filePath.toLowerCase();

    // Test files
    if (pathLower.includes('test') || pathLower.includes('spec') || 
        fileName.includes('test') || fileName.includes('spec') ||
        fileName.startsWith('test_') || content.includes('import unittest') ||
        content.includes('import pytest') || content.includes('def test_')) {
      return 'test';
    }

    // Config files
    if (fileName.includes('config') || fileName.includes('settings') || 
        pathLower.includes('config') || fileName === 'setup' ||
        fileName === '__init__') {
      return 'config';
    }

    // Views/Templates
    if (pathLower.includes('view') || pathLower.includes('template') ||
        content.includes('from django') || content.includes('from flask')) {
      return 'view';
    }

    // Models
    if (fileName.includes('model') || pathLower.includes('model') ||
        content.includes('class.*Model') || content.includes('from django.db')) {
      return 'model';
    }

    // Services/Business Logic
    if (fileName.includes('service') || fileName.includes('manager') ||
        fileName.includes('handler') || pathLower.includes('service')) {
      return 'service';
    }

    // Controllers (Django views, Flask routes)
    if (fileName.includes('view') || fileName.includes('route') ||
        pathLower.includes('controller') || content.includes('@app.route') ||
        content.includes('def.*request')) {
      return 'controller';
    }

    // Utilities
    if (fileName.includes('util') || fileName.includes('helper') || 
        pathLower.includes('util') || pathLower.includes('helper') ||
        fileName.includes('tool')) {
      return 'utility';
    }

    // Scripts
    if (fileName.includes('script') || fileName.includes('cli') ||
        content.includes('if __name__ == "__main__"')) {
      return 'utility';
    }

    return 'unknown';
  }

  static getLanguage(): string {
    return 'Python';
  }

  /**
   * Extract requirements from requirements.txt or setup.py files
   */
  static extractRequirements(content: string, fileName: string): string[] {
    const requirements: string[] = [];

    if (fileName === 'requirements.txt' || fileName.endsWith('requirements.txt')) {
      const lines = content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          // Extract package name (ignore version specifiers)
          const match = trimmed.match(/^([a-zA-Z0-9\-_]+)/);
          if (match) {
            requirements.push(match[1]);
          }
        }
      }
    } else if (fileName === 'setup.py') {
      // Extract from install_requires
      const installRequiresMatch = content.match(/install_requires\s*=\s*\[(.*?)\]/s);
      if (installRequiresMatch) {
        const requiresStr = installRequiresMatch[1];
        const matches = requiresStr.match(/"([^"]+)"|'([^']+)'/g);
        if (matches) {
          for (const match of matches) {
            const pkg = match.slice(1, -1); // Remove quotes
            const pkgName = pkg.split(/[>=<]/)[0].trim();
            requirements.push(pkgName);
          }
        }
      }
    }

    return requirements;
  }
}