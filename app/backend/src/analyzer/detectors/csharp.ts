import * as fs from 'fs';
import * as path from 'path';
import { logger, getFileExtension } from '../../core/utils';

export interface CSharpAnalysisResult {
  namespaces: string[];
  classes: string[];
  interfaces: string[];
  usings: string[];
  dependencies: string[];
  projectReferences: string[];
}

export class CSharpDetector {
  private static readonly SUPPORTED_EXTENSIONS = ['.cs', '.csproj', '.sln'];
  
  static isSupported(filePath: string): boolean {
    const ext = getFileExtension(filePath);
    return this.SUPPORTED_EXTENSIONS.includes(ext);
  }

  static async analyze(filePath: string): Promise<CSharpAnalysisResult> {
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const ext = getFileExtension(filePath);
      
      if (ext === '.csproj') {
        return this.analyzeCsproj(content);
      } else if (ext === '.sln') {
        return this.analyzeSolution(content);
      } else {
        return this.analyzeCsFile(content);
      }
    } catch (error) {
      logger.error(`Failed to analyze C# file ${filePath}:`, error);
      return {
        namespaces: [],
        classes: [],
        interfaces: [],
        usings: [],
        dependencies: [],
        projectReferences: []
      };
    }
  }

  private static analyzeCsFile(content: string): CSharpAnalysisResult {
    const result: CSharpAnalysisResult = {
      namespaces: [],
      classes: [],
      interfaces: [],
      usings: [],
      dependencies: [],
      projectReferences: []
    };

    // Extract using statements
    const usingRegex = /using\s+([^;]+);/g;
    let match;
    while ((match = usingRegex.exec(content)) !== null) {
      const usingStatement = match[1].trim();
      if (!usingStatement.startsWith('static') && !usingStatement.includes('=')) {
        result.usings.push(usingStatement);
      }
    }

    // Extract namespaces
    const namespaceRegex = /namespace\s+([^\s{]+)/g;
    while ((match = namespaceRegex.exec(content)) !== null) {
      result.namespaces.push(match[1].trim());
    }

    // Extract classes
    const classRegex = /(?:public|private|internal|protected)?\s*(?:static|abstract|sealed)?\s*class\s+(\w+)/g;
    while ((match = classRegex.exec(content)) !== null) {
      result.classes.push(match[1]);
    }

    // Extract interfaces
    const interfaceRegex = /(?:public|private|internal|protected)?\s*interface\s+(\w+)/g;
    while ((match = interfaceRegex.exec(content)) !== null) {
      result.interfaces.push(match[1]);
    }

    // Dependencies are the unique using statements
    result.dependencies = [...new Set(result.usings)];

    return result;
  }

  private static analyzeCsproj(content: string): CSharpAnalysisResult {
    const result: CSharpAnalysisResult = {
      namespaces: [],
      classes: [],
      interfaces: [],
      usings: [],
      dependencies: [],
      projectReferences: []
    };

    // Extract package references
    const packageRefRegex = /<PackageReference\s+Include="([^"]+)"/g;
    let match;
    while ((match = packageRefRegex.exec(content)) !== null) {
      result.dependencies.push(match[1]);
    }

    // Extract project references
    const projectRefRegex = /<ProjectReference\s+Include="([^"]+)"/g;
    while ((match = projectRefRegex.exec(content)) !== null) {
      result.projectReferences.push(match[1]);
    }

    return result;
  }

  private static analyzeSolution(content: string): CSharpAnalysisResult {
    const result: CSharpAnalysisResult = {
      namespaces: [],
      classes: [],
      interfaces: [],
      usings: [],
      dependencies: [],
      projectReferences: []
    };

    // Extract project references from solution file
    const projectRegex = /Project\("[^"]+"\)\s*=\s*"[^"]+",\s*"([^"]+)"/g;
    let match;
    while ((match = projectRegex.exec(content)) !== null) {
      const projectPath = match[1];
      if (projectPath.endsWith('.csproj')) {
        result.projectReferences.push(projectPath);
      }
    }

    return result;
  }

  static inferRole(filePath: string, content: string): string {
    const fileName = path.basename(filePath, path.extname(filePath)).toLowerCase();
    const pathLower = filePath.toLowerCase();

    // Test files
    if (pathLower.includes('test') || pathLower.includes('spec') || 
        fileName.includes('test') || fileName.includes('spec') ||
        content.includes('[Test]') || content.includes('[TestMethod]')) {
      return 'test';
    }

    // Controllers
    if (fileName.includes('controller') || pathLower.includes('controller') ||
        content.includes('[Controller]') || content.includes('[ApiController]')) {
      return 'controller';
    }

    // Services
    if (fileName.includes('service') || pathLower.includes('service') ||
        content.includes('[Service]') || fileName.includes('manager')) {
      return 'service';
    }

    // Models/Entities
    if (fileName.includes('model') || fileName.includes('entity') || 
        pathLower.includes('model') || pathLower.includes('entity') ||
        content.includes('[Entity]') || content.includes('[Table]')) {
      return 'model';
    }

    // Config files
    if (fileName.includes('config') || fileName.includes('settings') || 
        pathLower.includes('config') || content.includes('[Configuration]')) {
      return 'config';
    }

    // Views/Components
    if (pathLower.includes('view') || pathLower.includes('component') ||
        content.includes('@model') || content.includes('@inherits')) {
      return 'view';
    }

    // Utilities
    if (fileName.includes('util') || fileName.includes('helper') || 
        pathLower.includes('util') || pathLower.includes('helper') ||
        fileName.includes('extension')) {
      return 'utility';
    }

    return 'unknown';
  }

  static getLanguage(filePath: string): string {
    const ext = getFileExtension(filePath);
    switch (ext) {
      case '.cs':
        return 'C#';
      case '.csproj':
        return 'MSBuild';
      case '.sln':
        return 'Solution';
      default:
        return 'C#';
    }
  }
}