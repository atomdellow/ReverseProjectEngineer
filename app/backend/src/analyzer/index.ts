import * as fs from 'fs';
import * as path from 'path';
import { Component, Module, Artifact, Relation, AnalysisSession, AnalysisSettings } from '../core/types';
import { logger, generateSessionId, matchesGlob, formatDuration } from '../core/utils';
import { AnalysisError } from '../core/errors';

// Detectors
import { JSTypeScriptDetector } from './detectors/jsTs';
import { CSharpDetector } from './detectors/csharp';
import { PythonDetector } from './detectors/python';
import { GenericDetector } from './detectors/generic';

// Graph components
import { GraphBuilder, BuilderContext, FileInfo } from './graph/builder';
import { Heuristics } from './graph/heuristics';

// Git integration
import { GitDates } from './git/dates';
import { GitBlame } from './git/blame';

export interface AnalysisResult {
  session: AnalysisSession;
  components: Component[];
  modules: Module[];
  artifacts: Artifact[];
  relations: Relation[];
  stats: {
    totalFiles: number;
    processedFiles: number;
    skippedFiles: number;
    languages: Record<string, number>;
    roles: Record<string, number>;
    patterns: string[];
  };
}

export class Analyzer {
  private settings: AnalysisSettings;

  constructor(settings: AnalysisSettings) {
    this.settings = settings;
  }

  /**
   * Analyze one or more repositories
   */
  async analyze(repositoryPaths: string[]): Promise<AnalysisResult> {
    const startTime = Date.now();
    const sessionId = generateSessionId(repositoryPaths, this.settings);

    logger.info(`Starting analysis session ${sessionId}`);
    logger.info(`Repository paths: ${repositoryPaths.join(', ')}`);

    try {
      // Step 1: Discover and scan files
      const fileInfoMap = await this.discoverFiles(repositoryPaths);
      logger.info(`Discovered ${fileInfoMap.size} files`);

      // Step 2: Analyze file contents
      await this.analyzeFileContents(fileInfoMap);
      logger.info(`Analyzed file contents`);

      // Step 3: Build graph structure
      const builderContext: BuilderContext = {
        sessionId,
        repositoryPaths,
        settings: this.settings,
        fileInfoMap
      };

      const graphBuilder = new GraphBuilder();
      const { components, modules, artifacts, relations } = await graphBuilder.buildGraph(builderContext);

      // Step 4: Apply heuristics and enrich data
      const enrichedComponents = Heuristics.applyTaggingHeuristics(components);
      const enrichedModules = Heuristics.applyTaggingHeuristics(modules);
      const enrichedArtifacts = Heuristics.applyTaggingHeuristics(artifacts);

      // Step 5: Integrate git data
      await this.integrateGitData(enrichedArtifacts, enrichedModules, enrichedComponents, repositoryPaths);

      // Step 6: Calculate final statistics
      const endTime = Date.now();
      const processingTimeMs = endTime - startTime;

      const stats = this.calculateStats(fileInfoMap, enrichedArtifacts, enrichedModules, enrichedComponents);
      stats.patterns = Heuristics.identifyArchitecturalPatterns(enrichedComponents, enrichedModules, enrichedArtifacts);

      const session: AnalysisSession = {
        id: sessionId,
        sessionId,
        status: 'completed',
        repositoryPaths,
        includeGlobs: this.settings.customRules?.includeGlobs || [],
        excludeGlobs: this.settings.customRules?.excludeGlobs || [],
        settings: this.settings,
        startedAt: new Date(startTime),
        finishedAt: new Date(endTime),
        stats: {
          componentsFound: enrichedComponents.length,
          modulesFound: enrichedModules.length,
          artifactsFound: enrichedArtifacts.length,
          relationsFound: relations.length,
          languagesDetected: Object.keys(stats.languages),
          processingTimeMs
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      logger.info(`Analysis completed in ${formatDuration(processingTimeMs)}`);

      return {
        session,
        components: enrichedComponents,
        modules: enrichedModules,
        artifacts: enrichedArtifacts,
        relations,
        stats
      };

    } catch (error) {
      logger.error(`Analysis failed for session ${sessionId}:`, error);
      throw new AnalysisError(`Analysis failed: ${error.message}`, error);
    }
  }

  /**
   * Discover files in the specified repositories
   */
  private async discoverFiles(repositoryPaths: string[]): Promise<Map<string, FileInfo>> {
    const fileInfoMap = new Map<string, FileInfo>();

    for (const repoPath of repositoryPaths) {
      if (!fs.existsSync(repoPath)) {
        logger.warn(`Repository path does not exist: ${repoPath}`);
        continue;
      }

      await this.scanDirectory(repoPath, repoPath, fileInfoMap);
    }

    return fileInfoMap;
  }

  /**
   * Recursively scan a directory for files
   */
  private async scanDirectory(
    currentPath: string,
    repoRoot: string,
    fileInfoMap: Map<string, FileInfo>,
    depth: number = 0
  ): Promise<void> {
    if (depth > this.settings.maxDepth) {
      return;
    }

    try {
      const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        const relativePath = path.relative(repoRoot, fullPath);

        // Skip hidden files and directories (unless explicitly included)
        if (entry.name.startsWith('.') && !this.shouldIncludeHidden(entry.name)) {
          continue;
        }

        // Skip node_modules unless specifically included
        if (entry.name === 'node_modules' && !this.settings.includeNodeModules) {
          continue;
        }

        // Apply include/exclude patterns
        if (this.settings.customRules?.excludeGlobs) {
          if (matchesGlob(relativePath, this.settings.customRules.excludeGlobs)) {
            continue;
          }
        }

        if (this.settings.customRules?.includeGlobs) {
          if (!matchesGlob(relativePath, this.settings.customRules.includeGlobs)) {
            continue;
          }
        }

        if (entry.isDirectory()) {
          await this.scanDirectory(fullPath, repoRoot, fileInfoMap, depth + 1);
        } else if (entry.isFile()) {
          // Check if it's a supported file type
          if (this.isSupportedFile(fullPath)) {
            const stats = await fs.promises.stat(fullPath);
            const language = this.detectLanguage(fullPath);

            // Filter by language if specified
            if (this.settings.languages.length > 0 && !this.settings.languages.includes(language)) {
              continue;
            }

            fileInfoMap.set(fullPath, {
              path: fullPath,
              name: entry.name,
              size: stats.size,
              language,
              role: 'unknown', // Will be determined during content analysis
              dependencies: [],
              exports: [],
              imports: []
            });
          }
        }
      }
    } catch (error) {
      logger.warn(`Failed to scan directory ${currentPath}:`, error.message);
    }
  }

  /**
   * Analyze the contents of discovered files
   */
  private async analyzeFileContents(fileInfoMap: Map<string, FileInfo>): Promise<void> {
    const batchSize = 50;
    const filePaths = Array.from(fileInfoMap.keys());

    for (let i = 0; i < filePaths.length; i += batchSize) {
      const batch = filePaths.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (filePath) => {
        const fileInfo = fileInfoMap.get(filePath)!;
        
        try {
          await this.analyzeFile(fileInfo);
        } catch (error) {
          logger.warn(`Failed to analyze file ${filePath}:`, error.message);
        }
      });

      await Promise.all(batchPromises);
      
      // Log progress
      if (i % (batchSize * 4) === 0) {
        logger.debug(`Analyzed ${Math.min(i + batchSize, filePaths.length)}/${filePaths.length} files`);
      }
    }
  }

  /**
   * Analyze a single file
   */
  private async analyzeFile(fileInfo: FileInfo): Promise<void> {
    const filePath = fileInfo.path;

    try {
      // Read file content
      const content = await fs.promises.readFile(filePath, 'utf-8');
      fileInfo.content = content;

      // Detect file role and extract dependencies based on language
      if (JSTypeScriptDetector.isSupported(filePath)) {
        const analysis = JSTypeScriptDetector.analyzeContent(content, filePath);
        fileInfo.imports = analysis.imports.map(imp => imp.source);
        fileInfo.exports = analysis.exports.map(exp => exp.name);
        fileInfo.dependencies = analysis.dependencies;
        fileInfo.role = JSTypeScriptDetector.inferRole(filePath, content);
      } else if (CSharpDetector.isSupported(filePath)) {
        const analysis = await CSharpDetector.analyze(filePath);
        fileInfo.imports = analysis.usings;
        fileInfo.exports = [...analysis.classes, ...analysis.interfaces];
        fileInfo.dependencies = analysis.dependencies;
        fileInfo.role = CSharpDetector.inferRole(filePath, content);
      } else if (PythonDetector.isSupported(filePath)) {
        const analysis = PythonDetector.analyzeContent(content);
        fileInfo.imports = analysis.imports.concat(analysis.fromImports.map(fi => fi.module));
        fileInfo.exports = [...analysis.functions, ...analysis.classes];
        fileInfo.dependencies = analysis.dependencies;
        fileInfo.role = PythonDetector.inferRole(filePath, content);
      } else if (GenericDetector.isSupported(filePath)) {
        const analysis = GenericDetector.analyzeContent(content, filePath);
        fileInfo.imports = analysis.imports;
        fileInfo.exports = analysis.symbols;
        fileInfo.dependencies = analysis.dependencies;
        fileInfo.role = GenericDetector.inferRole(filePath, content);
      } else {
        // Fallback for unsupported file types
        fileInfo.role = this.inferGenericRole(filePath, content);
      }

    } catch (error) {
      logger.warn(`Failed to read file ${filePath}:`, error.message);
      fileInfo.role = 'unknown';
    }
  }

  /**
   * Integrate git data into the analysis
   */
  private async integrateGitData(
    artifacts: Artifact[],
    modules: Module[],
    components: Component[],
    repositoryPaths: string[]
  ): Promise<void> {
    logger.info('Integrating git data...');

    for (const repoPath of repositoryPaths) {
      if (!GitDates.isGitRepository(repoPath)) {
        logger.warn(`${repoPath} is not a git repository, skipping git integration`);
        continue;
      }

      try {
        // Get timeline data for artifacts
        const artifactsInRepo = artifacts.filter(a => a.path.startsWith(repoPath));
        const artifactPaths = artifactsInRepo.map(a => a.path);
        
        const timelines = await GitDates.getMultipleFileTimelines(artifactPaths, repoPath);

        // Update artifacts with git data
        for (const artifact of artifactsInRepo) {
          const timeline = timelines.get(artifact.path);
          if (timeline) {
            artifact.firstSeenAt = timeline.firstSeenAt;
            artifact.lastChangedAt = timeline.lastChangedAt;
            artifact.commitCount = timeline.commitCount;
          }
        }

        // Update modules with aggregated git data
        const modulesInRepo = modules.filter(m => m.path.startsWith(repoPath));
        for (const module of modulesInRepo) {
          const moduleArtifacts = artifacts.filter(a => a.moduleId === module.id);
          if (moduleArtifacts.length > 0) {
            module.firstSeenAt = new Date(Math.min(...moduleArtifacts.map(a => a.firstSeenAt.getTime())));
            module.lastChangedAt = new Date(Math.max(...moduleArtifacts.map(a => a.lastChangedAt.getTime())));
            module.commitCount = moduleArtifacts.reduce((sum, a) => sum + a.commitCount, 0);
          }
        }

        // Update components with aggregated git data
        const componentsInRepo = components.filter(c => c.path.startsWith(repoPath));
        for (const component of componentsInRepo) {
          const componentModules = modules.filter(m => m.componentId === component.id);
          if (componentModules.length > 0) {
            component.firstSeenAt = new Date(Math.min(...componentModules.map(m => m.firstSeenAt.getTime())));
            component.lastChangedAt = new Date(Math.max(...componentModules.map(m => m.lastChangedAt.getTime())));
            component.commitCount = componentModules.reduce((sum, m) => sum + m.commitCount, 0);
          }
        }

      } catch (error) {
        logger.warn(`Failed to integrate git data for ${repoPath}:`, error.message);
      }
    }
  }

  /**
   * Calculate analysis statistics
   */
  private calculateStats(
    fileInfoMap: Map<string, FileInfo>,
    artifacts: Artifact[],
    modules: Module[],
    components: Component[]
  ) {
    const languages: Record<string, number> = {};
    const roles: Record<string, number> = {};
    let processedFiles = 0;

    for (const fileInfo of fileInfoMap.values()) {
      languages[fileInfo.language] = (languages[fileInfo.language] || 0) + 1;
      roles[fileInfo.role] = (roles[fileInfo.role] || 0) + 1;
      if (fileInfo.role !== 'unknown') {
        processedFiles++;
      }
    }

    return {
      totalFiles: fileInfoMap.size,
      processedFiles,
      skippedFiles: fileInfoMap.size - processedFiles,
      languages,
      roles,
      patterns: [] // Will be populated by heuristics
    };
  }

  /**
   * Check if a file should be included in analysis
   */
  private isSupportedFile(filePath: string): boolean {
    return (
      JSTypeScriptDetector.isSupported(filePath) ||
      CSharpDetector.isSupported(filePath) ||
      PythonDetector.isSupported(filePath) ||
      GenericDetector.isSupported(filePath)
    );
  }

  /**
   * Detect the primary language of a file
   */
  private detectLanguage(filePath: string): string {
    if (JSTypeScriptDetector.isSupported(filePath)) {
      const ext = path.extname(filePath);
      return ['.ts', '.tsx'].includes(ext) ? 'TypeScript' : 'JavaScript';
    } else if (CSharpDetector.isSupported(filePath)) {
      return CSharpDetector.getLanguage(filePath);
    } else if (PythonDetector.isSupported(filePath)) {
      return PythonDetector.getLanguage();
    } else if (GenericDetector.isSupported(filePath)) {
      return GenericDetector.getLanguage(filePath);
    }
    
    return 'Unknown';
  }

  /**
   * Infer role for generic files
   */
  private inferGenericRole(filePath: string, content: string): string {
    const fileName = path.basename(filePath).toLowerCase();
    
    if (fileName.includes('test') || fileName.includes('spec')) {
      return 'test';
    } else if (fileName.includes('config') || fileName.includes('setting')) {
      return 'config';
    } else if (fileName.includes('readme') || fileName.includes('doc')) {
      return 'utility';
    }
    
    return 'unknown';
  }

  /**
   * Check if hidden files should be included
   */
  private shouldIncludeHidden(fileName: string): boolean {
    // Include common config files
    const commonConfigFiles = [
      '.gitignore', '.dockerignore', '.env.example',
      '.eslintrc', '.prettierrc', '.babelrc'
    ];
    
    return commonConfigFiles.some(config => fileName.startsWith(config));
  }
}