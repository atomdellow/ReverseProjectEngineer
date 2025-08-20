import { execSync } from 'child_process';
import * as path from 'path';
import { GitCommitInfo } from '../../core/types';
import { logger } from '../../core/utils';
import { GitError } from '../../core/errors';

export interface GitTimelineInfo {
  firstSeenAt: Date;
  lastChangedAt: Date;
  commitCount: number;
  commits: GitCommitInfo[];
}

export class GitDates {
  /**
   * Get timeline information for a specific file
   */
  static async getFileTimeline(filePath: string, repoPath: string): Promise<GitTimelineInfo> {
    try {
      const relativePath = path.relative(repoPath, filePath);
      
      // Get all commits that modified this file
      const commits = await this.getFileCommits(relativePath, repoPath);
      
      if (commits.length === 0) {
        // File might be new or not tracked
        const now = new Date();
        return {
          firstSeenAt: now,
          lastChangedAt: now,
          commitCount: 0,
          commits: []
        };
      }

      // Sort commits by date
      commits.sort((a, b) => a.date.getTime() - b.date.getTime());

      return {
        firstSeenAt: commits[0].date,
        lastChangedAt: commits[commits.length - 1].date,
        commitCount: commits.length,
        commits
      };

    } catch (error) {
      logger.error(`Failed to get timeline for ${filePath}:`, error);
      throw new GitError(`Failed to get git timeline for file: ${error.message}`);
    }
  }

  /**
   * Get timeline information for multiple files
   */
  static async getMultipleFileTimelines(
    filePaths: string[],
    repoPath: string
  ): Promise<Map<string, GitTimelineInfo>> {
    const timelines = new Map<string, GitTimelineInfo>();

    // Process files in batches to avoid overwhelming git
    const batchSize = 50;
    for (let i = 0; i < filePaths.length; i += batchSize) {
      const batch = filePaths.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (filePath) => {
        try {
          const timeline = await this.getFileTimeline(filePath, repoPath);
          return { filePath, timeline };
        } catch (error) {
          logger.warn(`Failed to get timeline for ${filePath}:`, error.message);
          return {
            filePath,
            timeline: {
              firstSeenAt: new Date(),
              lastChangedAt: new Date(),
              commitCount: 0,
              commits: []
            }
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(({ filePath, timeline }) => {
        timelines.set(filePath, timeline);
      });

      // Small delay between batches to be respectful to git
      if (i + batchSize < filePaths.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return timelines;
  }

  /**
   * Get directory timeline by aggregating file timelines
   */
  static async getDirectoryTimeline(
    dirPath: string,
    repoPath: string,
    filePaths: string[]
  ): Promise<GitTimelineInfo> {
    try {
      const filesInDir = filePaths.filter(fp => fp.startsWith(dirPath));
      
      if (filesInDir.length === 0) {
        const now = new Date();
        return {
          firstSeenAt: now,
          lastChangedAt: now,
          commitCount: 0,
          commits: []
        };
      }

      const fileTimelines = await this.getMultipleFileTimelines(filesInDir, repoPath);
      
      let earliestDate = new Date();
      let latestDate = new Date(0);
      let totalCommits = 0;
      const allCommits: GitCommitInfo[] = [];

      for (const timeline of fileTimelines.values()) {
        if (timeline.commits.length > 0) {
          if (timeline.firstSeenAt < earliestDate) {
            earliestDate = timeline.firstSeenAt;
          }
          if (timeline.lastChangedAt > latestDate) {
            latestDate = timeline.lastChangedAt;
          }
          totalCommits += timeline.commitCount;
          allCommits.push(...timeline.commits);
        }
      }

      // Remove duplicate commits and sort
      const uniqueCommits = this.deduplicateCommits(allCommits);
      uniqueCommits.sort((a, b) => a.date.getTime() - b.date.getTime());

      return {
        firstSeenAt: earliestDate,
        lastChangedAt: latestDate > new Date(0) ? latestDate : new Date(),
        commitCount: uniqueCommits.length,
        commits: uniqueCommits
      };

    } catch (error) {
      logger.error(`Failed to get directory timeline for ${dirPath}:`, error);
      throw new GitError(`Failed to get directory timeline: ${error.message}`);
    }
  }

  /**
   * Get commit history for the entire repository
   */
  static async getRepositoryHistory(repoPath: string): Promise<GitCommitInfo[]> {
    try {
      const gitCommand = 'git log --pretty=format:"%H|%an|%ae|%ai|%s" --no-merges';
      const output = execSync(gitCommand, {
        cwd: repoPath,
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });

      return this.parseGitLogOutput(output);

    } catch (error) {
      logger.error(`Failed to get repository history for ${repoPath}:`, error);
      throw new GitError(`Failed to get repository history: ${error.message}`);
    }
  }

  /**
   * Get commits that modified specific files
   */
  private static async getFileCommits(relativePath: string, repoPath: string): Promise<GitCommitInfo[]> {
    try {
      const gitCommand = `git log --follow --pretty=format:"%H|%an|%ae|%ai|%s" --no-merges -- "${relativePath}"`;
      const output = execSync(gitCommand, {
        cwd: repoPath,
        encoding: 'utf-8',
        maxBuffer: 1024 * 1024 // 1MB buffer per file
      });

      const commits = this.parseGitLogOutput(output);
      
      // Get file changes for each commit
      for (const commit of commits) {
        try {
          const filesCommand = `git show --name-only --pretty=format: ${commit.sha}`;
          const filesOutput = execSync(filesCommand, {
            cwd: repoPath,
            encoding: 'utf-8'
          });
          
          commit.filesChanged = filesOutput
            .split('\n')
            .filter(line => line.trim())
            .map(line => line.trim());
            
        } catch (error) {
          logger.warn(`Failed to get changed files for commit ${commit.sha}:`, error.message);
          commit.filesChanged = [relativePath];
        }
      }

      return commits;

    } catch (error) {
      if (error.message.includes('does not have any commits yet')) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Parse git log output into GitCommitInfo objects
   */
  private static parseGitLogOutput(output: string): GitCommitInfo[] {
    if (!output.trim()) return [];

    const lines = output.trim().split('\n');
    const commits: GitCommitInfo[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;

      const parts = line.split('|');
      if (parts.length >= 5) {
        commits.push({
          sha: parts[0],
          author: parts[1],
          email: parts[2],
          date: new Date(parts[3]),
          message: parts.slice(4).join('|'), // Handle messages with | character
          filesChanged: [] // Will be populated separately if needed
        });
      }
    }

    return commits;
  }

  /**
   * Remove duplicate commits based on SHA
   */
  private static deduplicateCommits(commits: GitCommitInfo[]): GitCommitInfo[] {
    const seen = new Set<string>();
    const unique: GitCommitInfo[] = [];

    for (const commit of commits) {
      if (!seen.has(commit.sha)) {
        seen.add(commit.sha);
        unique.push(commit);
      }
    }

    return unique;
  }

  /**
   * Get effort estimate based on commit frequency and file changes
   */
  static calculateEffortEstimate(timeline: GitTimelineInfo): number {
    if (timeline.commits.length === 0) return 1;

    // Base effort from number of commits
    let effort = timeline.commitCount;

    // Factor in time span
    const timeSpanMs = timeline.lastChangedAt.getTime() - timeline.firstSeenAt.getTime();
    const timeSpanDays = timeSpanMs / (1000 * 60 * 60 * 24);
    
    if (timeSpanDays > 0) {
      // More commits over longer time suggests more complexity
      const commitsPerDay = timeline.commitCount / timeSpanDays;
      effort *= Math.log(commitsPerDay + 1);
    }

    // Factor in file changes complexity
    const totalFileChanges = timeline.commits.reduce(
      (sum, commit) => sum + (commit.filesChanged?.length || 1), 
      0
    );
    
    effort *= Math.log(totalFileChanges / timeline.commitCount + 1);

    return Math.max(1, Math.round(effort));
  }

  /**
   * Create worklog entries from git history
   */
  static createWorklogEntries(
    timeline: GitTimelineInfo,
    bucketMinutes: number = 60,
    maxDailySeconds: number = 21600 // 6 hours
  ): Array<{ date: Date; timeSpentSeconds: number; description: string }> {
    const worklogs: Array<{ date: Date; timeSpentSeconds: number; description: string }> = [];
    
    if (timeline.commits.length === 0) return worklogs;

    // Group commits by day
    const commitsByDay = new Map<string, GitCommitInfo[]>();
    
    for (const commit of timeline.commits) {
      const dayKey = commit.date.toISOString().split('T')[0];
      if (!commitsByDay.has(dayKey)) {
        commitsByDay.set(dayKey, []);
      }
      commitsByDay.get(dayKey)!.push(commit);
    }

    // Create worklog entries for each day
    for (const [dayKey, dayCommits] of commitsByDay) {
      const date = new Date(dayKey + 'T09:00:00'); // Default to 9 AM
      
      // Calculate time spent based on number of commits and complexity
      let timeSpentSeconds = Math.min(
        dayCommits.length * bucketMinutes * 60, // Base time per commit
        maxDailySeconds // Cap daily time
      );

      // Adjust based on commit complexity (number of files changed)
      const avgFilesChanged = dayCommits.reduce(
        (sum, commit) => sum + (commit.filesChanged?.length || 1), 
        0
      ) / dayCommits.length;
      
      timeSpentSeconds *= Math.min(2, Math.log(avgFilesChanged + 1));
      timeSpentSeconds = Math.round(timeSpentSeconds);

      // Create description from commit messages
      const description = dayCommits
        .map(commit => commit.message.split('\n')[0]) // First line only
        .slice(0, 3) // Max 3 commit messages
        .join('; ');

      worklogs.push({
        date,
        timeSpentSeconds,
        description: description.substring(0, 200) // Limit description length
      });
    }

    return worklogs.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  /**
   * Check if a directory is a git repository
   */
  static isGitRepository(dirPath: string): boolean {
    try {
      execSync('git rev-parse --git-dir', {
        cwd: dirPath,
        stdio: 'ignore'
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the root directory of a git repository
   */
  static getGitRoot(dirPath: string): string | null {
    try {
      const gitRoot = execSync('git rev-parse --show-toplevel', {
        cwd: dirPath,
        encoding: 'utf-8'
      }).trim();
      return gitRoot;
    } catch {
      return null;
    }
  }
}