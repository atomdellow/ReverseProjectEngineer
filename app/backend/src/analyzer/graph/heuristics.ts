import * as path from 'path';
import { Component, Module, Artifact, AnalysisSettings } from '../../core/types';
import { logger } from '../../core/utils';

export interface HeuristicRules {
  componentGrouping: ComponentGroupingRule[];
  moduleGrouping: ModuleGroupingRule[];
  tagging: TaggingRule[];
}

export interface ComponentGroupingRule {
  name: string;
  condition: (path: string, files: string[]) => boolean;
  action: 'group' | 'separate' | 'skip';
  priority: number;
}

export interface ModuleGroupingRule {
  name: string;
  condition: (path: string, files: string[]) => boolean;
  action: 'group' | 'separate' | 'skip';
  priority: number;
}

export interface TaggingRule {
  name: string;
  condition: (entity: Component | Module | Artifact) => boolean;
  tags: string[];
}

export class Heuristics {
  private static readonly DEFAULT_RULES: HeuristicRules = {
    componentGrouping: [
      {
        name: 'feature-directories',
        condition: (dirPath: string, files: string[]) => {
          const baseName = path.basename(dirPath).toLowerCase();
          return ['features', 'modules', 'components', 'pages', 'views'].includes(baseName);
        },
        action: 'group',
        priority: 10
      },
      {
        name: 'src-structure',
        condition: (dirPath: string, files: string[]) => {
          return dirPath.includes('/src/') && files.length > 5;
        },
        action: 'group',
        priority: 8
      },
      {
        name: 'package-boundaries',
        condition: (dirPath: string, files: string[]) => {
          return files.some(f => path.basename(f) === 'package.json');
        },
        action: 'separate',
        priority: 9
      }
    ],
    moduleGrouping: [
      {
        name: 'controller-grouping',
        condition: (dirPath: string, files: string[]) => {
          return files.some(f => f.toLowerCase().includes('controller'));
        },
        action: 'group',
        priority: 8
      },
      {
        name: 'service-grouping',
        condition: (dirPath: string, files: string[]) => {
          return files.some(f => f.toLowerCase().includes('service'));
        },
        action: 'group',
        priority: 8
      },
      {
        name: 'model-grouping',
        condition: (dirPath: string, files: string[]) => {
          return files.some(f => f.toLowerCase().includes('model'));
        },
        action: 'group',
        priority: 8
      },
      {
        name: 'small-directories',
        condition: (dirPath: string, files: string[]) => {
          return files.length <= 2;
        },
        action: 'group',
        priority: 5
      }
    ],
    tagging: [
      {
        name: 'test-components',
        condition: (entity) => {
          if (entity.type === 'component') {
            return (entity as Component).artifacts.length > 0 && 
                   entity.tags.includes('test');
          }
          return false;
        },
        tags: ['testing', 'quality-assurance']
      },
      {
        name: 'api-modules',
        condition: (entity) => {
          return entity.path.toLowerCase().includes('api') ||
                 entity.path.toLowerCase().includes('controller');
        },
        tags: ['api', 'interface']
      },
      {
        name: 'database-modules',
        condition: (entity) => {
          return entity.path.toLowerCase().includes('model') ||
                 entity.path.toLowerCase().includes('entity') ||
                 entity.path.toLowerCase().includes('repository');
        },
        tags: ['database', 'persistence']
      },
      {
        name: 'utility-modules',
        condition: (entity) => {
          return entity.path.toLowerCase().includes('util') ||
                 entity.path.toLowerCase().includes('helper') ||
                 entity.path.toLowerCase().includes('tool');
        },
        tags: ['utility', 'helper']
      }
    ]
  };

  static applyComponentGroupingHeuristics(
    directories: Map<string, string[]>,
    settings: AnalysisSettings
  ): Map<string, string[]> {
    logger.debug('Applying component grouping heuristics');

    const rules = this.DEFAULT_RULES.componentGrouping
      .sort((a, b) => b.priority - a.priority);

    const result = new Map<string, string[]>();

    for (const [dirPath, files] of directories) {
      let action: 'group' | 'separate' | 'skip' = 'group';
      
      // Apply rules in priority order
      for (const rule of rules) {
        if (rule.condition(dirPath, files)) {
          action = rule.action;
          logger.debug(`Applied rule '${rule.name}' to ${dirPath}: ${action}`);
          break;
        }
      }

      if (action === 'separate') {
        // Keep as separate component
        result.set(dirPath, files);
      } else if (action === 'group') {
        // Try to group with parent or similar directories
        const groupedPath = this.findGroupingCandidate(dirPath, directories, files);
        if (!result.has(groupedPath)) {
          result.set(groupedPath, []);
        }
        result.get(groupedPath)!.push(...files);
      }
      // Skip action ignores the directory
    }

    return result;
  }

  static applyModuleGroupingHeuristics(
    directories: Map<string, string[]>,
    settings: AnalysisSettings
  ): Map<string, string[]> {
    logger.debug('Applying module grouping heuristics');

    const rules = this.DEFAULT_RULES.moduleGrouping
      .sort((a, b) => b.priority - a.priority);

    const result = new Map<string, string[]>();

    for (const [dirPath, files] of directories) {
      let action: 'group' | 'separate' | 'skip' = 'separate';
      
      // Apply rules in priority order
      for (const rule of rules) {
        if (rule.condition(dirPath, files)) {
          action = rule.action;
          logger.debug(`Applied rule '${rule.name}' to ${dirPath}: ${action}`);
          break;
        }
      }

      if (action === 'separate') {
        // Keep as separate module
        result.set(dirPath, files);
      } else if (action === 'group') {
        // Group with parent directory
        const parentPath = path.dirname(dirPath);
        if (!result.has(parentPath)) {
          result.set(parentPath, []);
        }
        result.get(parentPath)!.push(...files);
      }
      // Skip action ignores the directory
    }

    return result;
  }

  static applyTaggingHeuristics<T extends Component | Module | Artifact>(
    entities: T[]
  ): T[] {
    logger.debug('Applying tagging heuristics');

    const rules = this.DEFAULT_RULES.tagging;

    return entities.map(entity => {
      const additionalTags: string[] = [];

      for (const rule of rules) {
        if (rule.condition(entity)) {
          additionalTags.push(...rule.tags);
          logger.debug(`Applied tagging rule '${rule.name}' to ${entity.path}`);
        }
      }

      // Add additional tags to existing ones
      if (additionalTags.length > 0) {
        const updatedEntity = { ...entity };
        updatedEntity.tags = [...new Set([...entity.tags, ...additionalTags])];
        return updatedEntity;
      }

      return entity;
    });
  }

  static inferEntityComplexity(entity: Component | Module | Artifact): number {
    let complexity = 0;

    // Base complexity from size
    if (entity.type === 'component') {
      const component = entity as Component;
      complexity += component.modules.length * 2;
      complexity += component.artifacts.length;
    } else if (entity.type === 'module') {
      const module = entity as Module;
      complexity += module.artifacts.length * 2;
    } else if (entity.type === 'artifact') {
      const artifact = entity as Artifact;
      complexity += Math.log(artifact.lines + 1) * 2;
      complexity += artifact.dependencies.length;
      complexity += artifact.imports.length * 0.5;
      complexity += artifact.exports.length * 0.3;
    }

    // Complexity modifiers based on tags
    if (entity.tags.includes('test')) complexity *= 0.7; // Tests are usually simpler
    if (entity.tags.includes('config')) complexity *= 0.5; // Config files are simple
    if (entity.tags.includes('api')) complexity *= 1.3; // APIs can be complex
    if (entity.tags.includes('database')) complexity *= 1.2; // DB logic can be complex

    // Path-based complexity
    const pathDepth = entity.path.split('/').length;
    complexity += pathDepth * 0.1;

    // Language-based complexity
    if (entity.type === 'artifact') {
      const artifact = entity as Artifact;
      switch (artifact.language.toLowerCase()) {
        case 'javascript':
        case 'typescript':
          complexity *= 1.0; // Baseline
          break;
        case 'c#':
        case 'java':
          complexity *= 1.1; // Slightly more complex due to type system
          break;
        case 'python':
          complexity *= 0.9; // Generally more concise
          break;
        case 'c++':
        case 'rust':
          complexity *= 1.3; // System languages are more complex
          break;
        default:
          complexity *= 1.0;
      }
    }

    return Math.max(1, Math.round(complexity));
  }

  static calculateRelationStrength(
    sourceEntity: Component | Module | Artifact,
    targetEntity: Component | Module | Artifact,
    relationType: string
  ): number {
    let strength = 0.5; // Base strength

    // Relation type modifiers
    switch (relationType) {
      case 'owns':
        strength = 1.0; // Ownership is strongest
        break;
      case 'imports':
        strength = 0.8; // Direct dependency
        break;
      case 'tests':
        strength = 0.9; // Test relationship is strong
        break;
      case 'configOf':
        strength = 0.7; // Configuration relationship
        break;
      case 'invokes':
        strength = 0.6; // Runtime dependency
        break;
      case 'depends':
        strength = 0.5; // General dependency
        break;
      case 'blocks':
        strength = 0.4; // Blocking relationship
        break;
    }

    // Distance modifier - closer entities have stronger relationships
    const sourceDepth = sourceEntity.path.split('/').length;
    const targetDepth = targetEntity.path.split('/').length;
    const depthDifference = Math.abs(sourceDepth - targetDepth);
    strength *= Math.max(0.3, 1 - (depthDifference * 0.1));

    // Same directory bonus
    const sourceDir = path.dirname(sourceEntity.path);
    const targetDir = path.dirname(targetEntity.path);
    if (sourceDir === targetDir) {
      strength *= 1.2;
    }

    // Language compatibility modifier
    if (sourceEntity.type === 'artifact' && targetEntity.type === 'artifact') {
      const sourceArtifact = sourceEntity as Artifact;
      const targetArtifact = targetEntity as Artifact;
      
      if (sourceArtifact.language === targetArtifact.language) {
        strength *= 1.1; // Same language bonus
      }
    }

    return Math.min(1.0, Math.max(0.1, strength));
  }

  static identifyArchitecturalPatterns(
    components: Component[],
    modules: Module[],
    artifacts: Artifact[]
  ): string[] {
    const patterns: string[] = [];

    // MVC Pattern
    const hasControllers = modules.some(m => m.tags.includes('controller') || m.path.includes('controller'));
    const hasModels = modules.some(m => m.tags.includes('model') || m.path.includes('model'));
    const hasViews = modules.some(m => m.tags.includes('view') || m.path.includes('view'));
    
    if (hasControllers && hasModels && hasViews) {
      patterns.push('MVC');
    }

    // Layered Architecture
    const hasApiLayer = modules.some(m => m.path.includes('api') || m.path.includes('controller'));
    const hasServiceLayer = modules.some(m => m.path.includes('service') || m.path.includes('business'));
    const hasDataLayer = modules.some(m => m.path.includes('repository') || m.path.includes('dao'));
    
    if (hasApiLayer && hasServiceLayer && hasDataLayer) {
      patterns.push('Layered Architecture');
    }

    // Microservices indicators
    const hasMultipleApis = modules.filter(m => m.path.includes('api')).length > 1;
    const hasServiceDiscovery = artifacts.some(a => a.name.includes('service-discovery') || a.name.includes('eureka'));
    
    if (hasMultipleApis || hasServiceDiscovery) {
      patterns.push('Microservices');
    }

    // Component-based architecture
    const componentDirs = components.filter(c => 
      c.path.includes('component') || c.path.includes('widget') || c.path.includes('element')
    );
    
    if (componentDirs.length > 3) {
      patterns.push('Component-based');
    }

    // Plugin architecture
    const hasPlugins = modules.some(m => m.path.includes('plugin') || m.path.includes('extension'));
    const hasPluginSystem = artifacts.some(a => a.name.includes('plugin') && a.role === 'service');
    
    if (hasPlugins && hasPluginSystem) {
      patterns.push('Plugin Architecture');
    }

    return patterns;
  }

  private static findGroupingCandidate(
    dirPath: string,
    allDirectories: Map<string, string[]>,
    files: string[]
  ): string {
    const parentPath = path.dirname(dirPath);
    
    // Check if parent should be the group
    if (allDirectories.has(parentPath)) {
      return parentPath;
    }

    // Look for sibling directories with similar characteristics
    const siblings = Array.from(allDirectories.keys())
      .filter(p => path.dirname(p) === path.dirname(dirPath) && p !== dirPath);

    for (const sibling of siblings) {
      const siblingFiles = allDirectories.get(sibling) || [];
      if (this.hasSimilarCharacteristics(files, siblingFiles)) {
        return sibling;
      }
    }

    // Default to parent directory
    return parentPath;
  }

  private static hasSimilarCharacteristics(files1: string[], files2: string[]): boolean {
    // Simple heuristic: check if files have similar extensions or naming patterns
    const ext1 = new Set(files1.map(f => path.extname(f)));
    const ext2 = new Set(files2.map(f => path.extname(f)));
    
    const commonExtensions = new Set([...ext1].filter(ext => ext2.has(ext)));
    
    return commonExtensions.size > 0;
  }
}