import { execSync } from 'child_process';
import * as path from 'path';
import { logger } from '../../core/utils';
import { GitError } from '../../core/errors';

export interface BlameInfo {
  author: string;
  email: string;
  date: Date;
  sha: string;
  lineNumber: number;
  content: string;
}

export interface FileBlameAnalysis {
  filePath: string;
  totalLines: number;
  authors: Map<string, number>; // author -> line count
  lastModified: Date;
  oldestLine: Date;
  authorDistribution: Array<{ author: string; lines: number; percentage: number }>;
  complexity: number;
}

export class GitBlame {
  /**
   * Get blame information for a specific file
   */
  static async getFileBlame(filePath: string, repoPath: string): Promise<BlameInfo[]> {
    try {
      const relativePath = path.relative(repoPath, filePath);
      
      const gitCommand = `git blame --line-porcelain "${relativePath}"`;
      const output = execSync(gitCommand, {
        cwd: repoPath,
        encoding: 'utf-8',
        maxBuffer: 5 * 1024 * 1024 // 5MB buffer
      });

      return this.parseBlameOutput(output);

    } catch (error) {
      if (error.message.includes('no such path') || error.message.includes('not found')) {
        logger.warn(`File not found in git: ${filePath}`);
        return [];
      }
      
      logger.error(`Failed to get blame for ${filePath}:`, error);
      throw new GitError(`Failed to get git blame: ${error.message}`);
    }
  }

  /**
   * Analyze file ownership and modification patterns
   */
  static async analyzeFileOwnership(filePath: string, repoPath: string): Promise<FileBlameAnalysis> {
    try {
      const blameInfo = await this.getFileBlame(filePath, repoPath);
      
      if (blameInfo.length === 0) {
        return {
          filePath,
          totalLines: 0,
          authors: new Map(),
          lastModified: new Date(),
          oldestLine: new Date(),
          authorDistribution: [],
          complexity: 0
        };
      }

      const authors = new Map<string, number>();
      const dates: Date[] = [];

      // Analyze blame information
      for (const blame of blameInfo) {
        const authorKey = `${blame.author} <${blame.email}>`;
        authors.set(authorKey, (authors.get(authorKey) || 0) + 1);
        dates.push(blame.date);
      }

      // Sort dates to find oldest and newest
      dates.sort((a, b) => a.getTime() - b.getTime());

      // Calculate author distribution
      const totalLines = blameInfo.length;
      const authorDistribution = Array.from(authors.entries())
        .map(([author, lines]) => ({
          author,
          lines,
          percentage: (lines / totalLines) * 100
        }))
        .sort((a, b) => b.lines - a.lines);

      // Calculate complexity based on author distribution and time span
      const complexity = this.calculateOwnershipComplexity(authorDistribution, dates);

      return {
        filePath,
        totalLines,
        authors,
        lastModified: dates[dates.length - 1],
        oldestLine: dates[0],
        authorDistribution,
        complexity
      };

    } catch (error) {
      logger.error(`Failed to analyze ownership for ${filePath}:`, error);
      throw new GitError(`Failed to analyze file ownership: ${error.message}`);
    }
  }

  /**
   * Get files with the most contributors (hotspots)
   */
  static async findHotspotFiles(
    filePaths: string[],
    repoPath: string,
    minContributors: number = 3
  ): Promise<Array<{ filePath: string; contributors: number; analysis: FileBlameAnalysis }>> {
    const hotspots: Array<{ filePath: string; contributors: number; analysis: FileBlameAnalysis }> = [];

    // Process files in batches
    const batchSize = 20;
    for (let i = 0; i < filePaths.length; i += batchSize) {
      const batch = filePaths.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (filePath) => {
        try {
          const analysis = await this.analyzeFileOwnership(filePath, repoPath);
          const contributors = analysis.authors.size;
          
          if (contributors >= minContributors) {
            return { filePath, contributors, analysis };
          }
          
          return null;
        } catch (error) {
          logger.warn(`Failed to analyze ${filePath}:`, error.message);
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      hotspots.push(...batchResults.filter(result => result !== null) as any[]);

      // Small delay between batches
      if (i + batchSize < filePaths.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    // Sort by number of contributors (descending)
    return hotspots.sort((a, b) => b.contributors - a.contributors);
  }

  /**
   * Find files that have been modified recently and frequently
   */
  static async findChurnFiles(
    filePaths: string[],
    repoPath: string,
    daysSince: number = 30
  ): Promise<Array<{ filePath: string; modifications: number; lastModified: Date }>> {
    const churnFiles: Array<{ filePath: string; modifications: number; lastModified: Date }> = [];
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - daysSince);

    try {
      // Get recent commits
      const gitCommand = `git log --since="${sinceDate.toISOString()}" --name-only --pretty=format:`;
      const output = execSync(gitCommand, {
        cwd: repoPath,
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });

      const modifiedFiles = new Map<string, number>();
      const lines = output.split('\n').filter(line => line.trim());

      // Count modifications per file
      for (const line of lines) {
        const fullPath = path.join(repoPath, line);
        if (filePaths.includes(fullPath)) {
          modifiedFiles.set(fullPath, (modifiedFiles.get(fullPath) || 0) + 1);
        }
      }

      // Get last modified dates for churned files
      for (const [filePath, modifications] of modifiedFiles) {
        if (modifications > 1) { // Only files modified more than once
          try {
            const analysis = await this.analyzeFileOwnership(filePath, repoPath);
            churnFiles.push({
              filePath,
              modifications,
              lastModified: analysis.lastModified
            });
          } catch (error) {
            logger.warn(`Failed to get last modified date for ${filePath}:`, error.message);
          }
        }
      }

      return churnFiles.sort((a, b) => b.modifications - a.modifications);

    } catch (error) {
      logger.error(`Failed to find churn files:`, error);
      throw new GitError(`Failed to find churn files: ${error.message}`);
    }
  }

  /**
   * Calculate code ownership metrics for a directory
   */
  static async calculateDirectoryOwnership(
    dirPath: string,
    filePaths: string[],
    repoPath: string
  ): Promise<{
    totalFiles: number;
    totalLines: number;
    primaryOwners: Array<{ author: string; files: number; lines: number }>;
    ownershipDistribution: number; // 0-1, higher means more distributed
  }> {
    const filesInDir = filePaths.filter(fp => fp.startsWith(dirPath));
    const ownershipData: Map<string, { files: number; lines: number }> = new Map();
    let totalLines = 0;

    // Analyze each file in the directory
    for (const filePath of filesInDir) {
      try {
        const analysis = await this.analyzeFileOwnership(filePath, repoPath);
        totalLines += analysis.totalLines;

        // Get primary owner (most lines)
        if (analysis.authorDistribution.length > 0) {
          const primaryOwner = analysis.authorDistribution[0].author;
          const existing = ownershipData.get(primaryOwner) || { files: 0, lines: 0 };
          ownershipData.set(primaryOwner, {
            files: existing.files + 1,
            lines: existing.lines + analysis.totalLines
          });
        }
      } catch (error) {
        logger.warn(`Failed to analyze ownership for ${filePath}:`, error.message);
      }
    }

    // Calculate ownership distribution (entropy-like measure)
    const primaryOwners = Array.from(ownershipData.entries())
      .map(([author, data]) => ({ author, ...data }))
      .sort((a, b) => b.lines - a.lines);

    let ownershipDistribution = 0;
    if (primaryOwners.length > 1 && totalLines > 0) {
      // Calculate normalized entropy
      let entropy = 0;
      for (const owner of primaryOwners) {
        const proportion = owner.lines / totalLines;
        if (proportion > 0) {
          entropy -= proportion * Math.log2(proportion);
        }
      }
      ownershipDistribution = entropy / Math.log2(primaryOwners.length);
    }

    return {
      totalFiles: filesInDir.length,
      totalLines,
      primaryOwners,
      ownershipDistribution
    };
  }

  /**
   * Parse git blame output into BlameInfo objects
   */
  private static parseBlameOutput(output: string): BlameInfo[] {
    const lines = output.split('\n');
    const blameInfo: BlameInfo[] = [];
    let currentCommit: Partial<BlameInfo> = {};
    let lineNumber = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.match(/^[a-f0-9]{40}/)) {
        // New commit SHA line
        currentCommit = {
          sha: line.split(' ')[0],
          lineNumber: lineNumber++
        };
      } else if (line.startsWith('author ')) {
        currentCommit.author = line.substring(7);
      } else if (line.startsWith('author-mail ')) {
        const email = line.substring(12);
        currentCommit.email = email.replace(/[<>]/g, '');
      } else if (line.startsWith('author-time ')) {
        const timestamp = parseInt(line.substring(12));
        currentCommit.date = new Date(timestamp * 1000);
      } else if (line.startsWith('\t')) {
        // Content line
        currentCommit.content = line.substring(1);
        
        // Complete blame info entry
        if (currentCommit.sha && currentCommit.author && currentCommit.email && currentCommit.date) {
          blameInfo.push(currentCommit as BlameInfo);
        }
        
        currentCommit = {};
      }
    }

    return blameInfo;
  }

  /**
   * Calculate ownership complexity based on author distribution and time span
   */
  private static calculateOwnershipComplexity(
    authorDistribution: Array<{ author: string; lines: number; percentage: number }>,
    dates: Date[]
  ): number {
    if (authorDistribution.length === 0 || dates.length === 0) return 0;

    // Factor 1: Number of contributors (more contributors = higher complexity)
    const contributorCount = authorDistribution.length;
    let complexity = Math.log(contributorCount + 1) * 2;

    // Factor 2: Distribution of ownership (more even = higher complexity)
    const topOwnerPercentage = authorDistribution[0].percentage;
    if (topOwnerPercentage < 80) {
      complexity *= 1.5; // Multiple significant contributors
    }

    // Factor 3: Time span (longer development = higher complexity)
    const timeSpanMs = dates[dates.length - 1].getTime() - dates[0].getTime();
    const timeSpanDays = timeSpanMs / (1000 * 60 * 60 * 24);
    complexity *= Math.log(timeSpanDays / 30 + 1); // Normalize to months

    // Factor 4: Recent activity (recent changes = potential complexity)
    const daysSinceLastChange = (Date.now() - dates[dates.length - 1].getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceLastChange < 30) {
      complexity *= 1.2; // Recently modified
    }

    return Math.round(complexity * 10) / 10; // Round to 1 decimal place
  }
}