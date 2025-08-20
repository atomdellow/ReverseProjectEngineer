import * as path from 'path';
import { Component, Module, Artifact, Relation, AnalysisSettings } from '../../core/types';
import { logger, generateFingerprint } from '../../core/utils';
import { JSTypeScriptDetector } from '../detectors/jsTs';
import { CSharpDetector } from '../detectors/csharp';
import { PythonDetector } from '../detectors/python';
import { GenericDetector } from '../detectors/generic';

export interface BuilderContext {
  sessionId: string;
  repositoryPaths: string[];
  settings: AnalysisSettings;
  fileInfoMap: Map<string, FileInfo>;
}

export interface FileInfo {
  path: string;
  name: string;
  size: number;
  language: string;
  role: string;
  content?: string;
  dependencies: string[];
  exports: string[];
  imports: string[];
}

export class GraphBuilder {
  private components: Map<string, Component> = new Map();
  private modules: Map<string, Module> = new Map();
  private artifacts: Map<string, Artifact> = new Map();
  private relations: Map<string, Relation> = new Map();

  async buildGraph(context: BuilderContext): Promise<{
    components: Component[];
    modules: Module[];
    artifacts: Artifact[];
    relations: Relation[];
  }> {
    logger.info(`Building graph for session ${context.sessionId}`);

    // Step 1: Create artifacts from files
    await this.createArtifacts(context);

    // Step 2: Group artifacts into modules
    await this.createModules(context);

    // Step 3: Group modules into components
    await this.createComponents(context);

    // Step 4: Create relations between entities
    await this.createRelations(context);

    return {
      components: Array.from(this.components.values()),
      modules: Array.from(this.modules.values()),
      artifacts: Array.from(this.artifacts.values()),
      relations: Array.from(this.relations.values())
    };
  }

  private async createArtifacts(context: BuilderContext): Promise<void> {
    logger.debug('Creating artifacts from files');

    for (const [filePath, fileInfo] of context.fileInfoMap) {
      const artifactId = generateFingerprint(context.sessionId, filePath);
      
      const artifact: Artifact = {
        id: artifactId,
        name: fileInfo.name,
        path: filePath,
        type: 'artifact',
        language: fileInfo.language,
        role: fileInfo.role as any,
        size: fileInfo.size,
        lines: this.countLines(fileInfo.content || ''),
        dependencies: [],
        exports: fileInfo.exports,
        imports: fileInfo.imports,
        firstSeenAt: new Date(), // Will be updated with git data
        lastChangedAt: new Date(), // Will be updated with git data
        commitCount: 0, // Will be updated with git data
        sessionId: context.sessionId,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      this.artifacts.set(artifactId, artifact);
    }

    logger.debug(`Created ${this.artifacts.size} artifacts`);
  }

  private async createModules(context: BuilderContext): Promise<void> {
    logger.debug('Grouping artifacts into modules');

    // Group artifacts by directory and other heuristics
    const moduleGroups = this.groupArtifactsIntoModules(context);

    for (const [modulePath, artifactIds] of moduleGroups) {
      const moduleId = generateFingerprint(context.sessionId, modulePath);
      const artifacts = artifactIds.map(id => this.artifacts.get(id)!).filter(Boolean);
      
      if (artifacts.length === 0) continue;

      const module: Module = {
        id: moduleId,
        name: path.basename(modulePath),
        description: this.generateModuleDescription(artifacts),
        path: modulePath,
        type: 'module',
        componentId: '', // Will be set when creating components
        artifacts: artifactIds,
        dependencies: [],
        firstSeenAt: new Date(Math.min(...artifacts.map(a => a.firstSeenAt.getTime()))),
        lastChangedAt: new Date(Math.max(...artifacts.map(a => a.lastChangedAt.getTime()))),
        commitCount: artifacts.reduce((sum, a) => sum + a.commitCount, 0),
        tags: this.generateModuleTags(artifacts),
        sessionId: context.sessionId,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Update artifacts with module reference
      artifactIds.forEach(artifactId => {
        const artifact = this.artifacts.get(artifactId);
        if (artifact) {
          artifact.moduleId = moduleId;
        }
      });

      this.modules.set(moduleId, module);
    }

    logger.debug(`Created ${this.modules.size} modules`);
  }

  private async createComponents(context: BuilderContext): Promise<void> {
    logger.debug('Grouping modules into components');

    // Group modules by higher-level directory structure
    const componentGroups = this.groupModulesIntoComponents(context);

    for (const [componentPath, moduleIds] of componentGroups) {
      const componentId = generateFingerprint(context.sessionId, componentPath);
      const modules = moduleIds.map(id => this.modules.get(id)!).filter(Boolean);
      
      if (modules.length === 0) continue;

      const allArtifactIds = modules.flatMap(m => m.artifacts);

      const component: Component = {
        id: componentId,
        name: path.basename(componentPath),
        description: this.generateComponentDescription(modules),
        path: componentPath,
        type: 'component',
        modules: moduleIds,
        artifacts: allArtifactIds,
        dependencies: [],
        firstSeenAt: new Date(Math.min(...modules.map(m => m.firstSeenAt.getTime()))),
        lastChangedAt: new Date(Math.max(...modules.map(m => m.lastChangedAt.getTime()))),
        commitCount: modules.reduce((sum, m) => sum + m.commitCount, 0),
        tags: this.generateComponentTags(modules),
        sessionId: context.sessionId,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Update modules with component reference
      moduleIds.forEach(moduleId => {
        const module = this.modules.get(moduleId);
        if (module) {
          module.componentId = componentId;
        }
      });

      // Update artifacts with component reference
      allArtifactIds.forEach(artifactId => {
        const artifact = this.artifacts.get(artifactId);
        if (artifact) {
          artifact.componentId = componentId;
        }
      });

      this.components.set(componentId, component);
    }

    logger.debug(`Created ${this.components.size} components`);
  }

  private async createRelations(context: BuilderContext): Promise<void> {
    logger.debug('Creating relations between entities');

    // Create artifact-level dependencies
    await this.createArtifactRelations(context);
    
    // Create module-level dependencies
    await this.createModuleRelations(context);
    
    // Create component-level dependencies
    await this.createComponentRelations(context);

    logger.debug(`Created ${this.relations.size} relations`);
  }

  private async createArtifactRelations(context: BuilderContext): Promise<void> {
    for (const [artifactId, artifact] of this.artifacts) {
      // Create import relations
      for (const importPath of artifact.imports) {
        const targetArtifact = this.findArtifactByImport(importPath, artifact.path, context);
        if (targetArtifact) {
          this.addRelation({
            type: 'imports',
            sourceId: artifactId,
            sourceType: 'artifact',
            targetId: targetArtifact.id,
            targetType: 'artifact',
            strength: 0.8,
            sessionId: context.sessionId
          });

          // Update artifact dependencies
          if (!artifact.dependencies.includes(targetArtifact.id)) {
            artifact.dependencies.push(targetArtifact.id);
          }
        }
      }

      // Create test relations
      if (artifact.role === 'test') {
        const testedArtifact = this.findTestedArtifact(artifact, context);
        if (testedArtifact) {
          this.addRelation({
            type: 'tests',
            sourceId: artifactId,
            sourceType: 'artifact',
            targetId: testedArtifact.id,
            targetType: 'artifact',
            strength: 0.9,
            sessionId: context.sessionId
          });
        }
      }
    }
  }

  private async createModuleRelations(context: BuilderContext): Promise<void> {
    for (const [moduleId, module] of this.modules) {
      const dependentModules = new Set<string>();

      // Aggregate dependencies from artifacts
      for (const artifactId of module.artifacts) {
        const artifact = this.artifacts.get(artifactId);
        if (!artifact) continue;

        for (const depArtifactId of artifact.dependencies) {
          const depArtifact = this.artifacts.get(depArtifactId);
          if (depArtifact && depArtifact.moduleId && depArtifact.moduleId !== moduleId) {
            dependentModules.add(depArtifact.moduleId);
          }
        }
      }

      // Create module relations
      for (const depModuleId of dependentModules) {
        this.addRelation({
          type: 'depends',
          sourceId: moduleId,
          sourceType: 'module',
          targetId: depModuleId,
          targetType: 'module',
          strength: 0.7,
          sessionId: context.sessionId
        });

        // Update module dependencies
        if (!module.dependencies.includes(depModuleId)) {
          module.dependencies.push(depModuleId);
        }
      }

      // Create ownership relations to artifacts
      for (const artifactId of module.artifacts) {
        this.addRelation({
          type: 'owns',
          sourceId: moduleId,
          sourceType: 'module',
          targetId: artifactId,
          targetType: 'artifact',
          strength: 1.0,
          sessionId: context.sessionId
        });
      }
    }
  }

  private async createComponentRelations(context: BuilderContext): Promise<void> {
    for (const [componentId, component] of this.components) {
      const dependentComponents = new Set<string>();

      // Aggregate dependencies from modules
      for (const moduleId of component.modules) {
        const module = this.modules.get(moduleId);
        if (!module) continue;

        for (const depModuleId of module.dependencies) {
          const depModule = this.modules.get(depModuleId);
          if (depModule && depModule.componentId && depModule.componentId !== componentId) {
            dependentComponents.add(depModule.componentId);
          }
        }
      }

      // Create component relations
      for (const depComponentId of dependentComponents) {
        this.addRelation({
          type: 'depends',
          sourceId: componentId,
          sourceType: 'component',
          targetId: depComponentId,
          targetType: 'component',
          strength: 0.6,
          sessionId: context.sessionId
        });

        // Update component dependencies
        if (!component.dependencies.includes(depComponentId)) {
          component.dependencies.push(depComponentId);
        }
      }

      // Create ownership relations to modules
      for (const moduleId of component.modules) {
        this.addRelation({
          type: 'owns',
          sourceId: componentId,
          sourceType: 'component',
          targetId: moduleId,
          targetType: 'module',
          strength: 1.0,
          sessionId: context.sessionId
        });
      }
    }
  }

  private groupArtifactsIntoModules(context: BuilderContext): Map<string, string[]> {
    const moduleGroups = new Map<string, string[]>();

    for (const [artifactId, artifact] of this.artifacts) {
      let modulePath = path.dirname(artifact.path);
      
      // Heuristics for module grouping
      if (this.isPackageRoot(modulePath, context)) {
        // Keep as-is for package roots
      } else if (this.shouldGroupByParentDirectory(modulePath, context)) {
        modulePath = path.dirname(modulePath);
      }

      if (!moduleGroups.has(modulePath)) {
        moduleGroups.set(modulePath, []);
      }
      moduleGroups.get(modulePath)!.push(artifactId);
    }

    return moduleGroups;
  }

  private groupModulesIntoComponents(context: BuilderContext): Map<string, string[]> {
    const componentGroups = new Map<string, string[]>();

    for (const [moduleId, module] of this.modules) {
      let componentPath = path.dirname(module.path);
      
      // Group by major directory boundaries
      const pathParts = componentPath.split(path.sep);
      if (pathParts.length > 2) {
        componentPath = pathParts.slice(0, -1).join(path.sep);
      }

      if (!componentGroups.has(componentPath)) {
        componentGroups.set(componentPath, []);
      }
      componentGroups.get(componentPath)!.push(moduleId);
    }

    return componentGroups;
  }

  private addRelation(relation: Omit<Relation, 'id' | 'createdAt' | 'updatedAt'>): void {
    const relationId = generateFingerprint(
      relation.sessionId,
      relation.sourceId,
      relation.targetId,
      relation.type
    );

    if (!this.relations.has(relationId)) {
      this.relations.set(relationId, {
        ...relation,
        id: relationId,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
  }

  private findArtifactByImport(importPath: string, fromPath: string, context: BuilderContext): Artifact | null {
    // Try to resolve the import to an actual file path
    const resolvedPath = this.resolveImportPath(importPath, fromPath, context);
    if (!resolvedPath) return null;

    for (const artifact of this.artifacts.values()) {
      if (artifact.path === resolvedPath) {
        return artifact;
      }
    }

    return null;
  }

  private resolveImportPath(importPath: string, fromPath: string, context: BuilderContext): string | null {
    // Simplified import resolution logic
    if (importPath.startsWith('./') || importPath.startsWith('../')) {
      // Relative import
      const basePath = path.dirname(fromPath);
      return path.resolve(basePath, importPath);
    } else if (importPath.startsWith('/')) {
      // Absolute import
      return importPath;
    } else {
      // Module import - try to find in node_modules or project root
      for (const repoPath of context.repositoryPaths) {
        const possiblePaths = [
          path.join(repoPath, 'node_modules', importPath, 'index.js'),
          path.join(repoPath, 'src', importPath + '.js'),
          path.join(repoPath, importPath + '.js'),
        ];
        
        for (const possiblePath of possiblePaths) {
          if (context.fileInfoMap.has(possiblePath)) {
            return possiblePath;
          }
        }
      }
    }

    return null;
  }

  private findTestedArtifact(testArtifact: Artifact, context: BuilderContext): Artifact | null {
    // Look for corresponding source file
    const testPath = testArtifact.path;
    const testDir = path.dirname(testPath);
    const testName = path.basename(testPath, path.extname(testPath));
    
    // Remove test suffixes
    const sourceName = testName
      .replace(/\.test$/, '')
      .replace(/\.spec$/, '')
      .replace(/Test$/, '')
      .replace(/Spec$/, '');

    // Look for source file in same or parent directory
    const possiblePaths = [
      path.join(testDir, sourceName + '.js'),
      path.join(testDir, sourceName + '.ts'),
      path.join(path.dirname(testDir), sourceName + '.js'),
      path.join(path.dirname(testDir), sourceName + '.ts'),
    ];

    for (const possiblePath of possiblePaths) {
      for (const artifact of this.artifacts.values()) {
        if (artifact.path === possiblePath) {
          return artifact;
        }
      }
    }

    return null;
  }

  private isPackageRoot(dirPath: string, context: BuilderContext): boolean {
    const packageJsonPath = path.join(dirPath, 'package.json');
    return context.fileInfoMap.has(packageJsonPath);
  }

  private shouldGroupByParentDirectory(dirPath: string, context: BuilderContext): boolean {
    // Heuristic: if directory has only a few files, group with parent
    const filesInDir = Array.from(context.fileInfoMap.keys())
      .filter(filePath => path.dirname(filePath) === dirPath);
    
    return filesInDir.length < 3;
  }

  private countLines(content: string): number {
    return content.split('\n').length;
  }

  private generateModuleDescription(artifacts: Artifact[]): string {
    const languages = [...new Set(artifacts.map(a => a.language))];
    const roles = [...new Set(artifacts.map(a => a.role))];
    return `Module with ${artifacts.length} files (${languages.join(', ')}) - ${roles.join(', ')}`;
  }

  private generateComponentDescription(modules: Module[]): string {
    const totalArtifacts = modules.reduce((sum, m) => sum + m.artifacts.length, 0);
    return `Component with ${modules.length} modules and ${totalArtifacts} files`;
  }

  private generateModuleTags(artifacts: Artifact[]): string[] {
    const tags = new Set<string>();
    
    // Add language tags
    artifacts.forEach(a => tags.add(a.language));
    
    // Add role tags
    artifacts.forEach(a => tags.add(a.role));
    
    // Add specific tags based on content
    if (artifacts.some(a => a.role === 'test')) tags.add('has-tests');
    if (artifacts.some(a => a.role === 'config')) tags.add('configuration');
    
    return Array.from(tags);
  }

  private generateComponentTags(modules: Module[]): string[] {
    const tags = new Set<string>();
    
    // Aggregate module tags
    modules.forEach(m => m.tags.forEach(tag => tags.add(tag)));
    
    // Add size-based tags
    const totalArtifacts = modules.reduce((sum, m) => sum + m.artifacts.length, 0);
    if (totalArtifacts > 50) tags.add('large');
    else if (totalArtifacts > 20) tags.add('medium');
    else tags.add('small');
    
    return Array.from(tags);
  }
}