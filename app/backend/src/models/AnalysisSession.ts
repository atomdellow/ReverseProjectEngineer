import { Schema, model, Document } from 'mongoose';
import { AnalysisSession as IAnalysisSession } from '../core/types';

export interface AnalysisSessionDocument extends IAnalysisSession, Document {}

const analysisSessionSchema = new Schema<AnalysisSessionDocument>({
  sessionId: { type: String, required: true, unique: true },
  status: {
    type: String,
    enum: ['pending', 'running', 'completed', 'failed'],
    default: 'pending'
  },
  repositoryPaths: [{ type: String, required: true }],
  includeGlobs: [{ type: String }],
  excludeGlobs: [{ type: String }],
  settings: {
    maxDepth: { type: Number, default: 10 },
    includeTests: { type: Boolean, default: true },
    includeNodeModules: { type: Boolean, default: false },
    languages: [{ type: String }],
    customRules: { type: Schema.Types.Mixed }
  },
  startedAt: { type: Date },
  finishedAt: { type: Date },
  error: { type: String },
  stats: {
    componentsFound: { type: Number, default: 0 },
    modulesFound: { type: Number, default: 0 },
    artifactsFound: { type: Number, default: 0 },
    relationsFound: { type: Number, default: 0 },
    languagesDetected: [{ type: String }],
    processingTimeMs: { type: Number, default: 0 }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Indexes for efficient queries
analysisSessionSchema.index({ sessionId: 1 }, { unique: true });
analysisSessionSchema.index({ status: 1 });
analysisSessionSchema.index({ createdAt: -1 });

// Virtual for duration
analysisSessionSchema.virtual('duration').get(function() {
  if (this.startedAt && this.finishedAt) {
    return this.finishedAt.getTime() - this.startedAt.getTime();
  }
  return null;
});

// Virtual for progress
analysisSessionSchema.virtual('progress').get(function() {
  const total = this.stats.componentsFound + this.stats.modulesFound + this.stats.artifactsFound;
  return {
    total,
    processed: total, // For completed sessions
    percentage: this.status === 'completed' ? 100 : 0
  };
});

export const AnalysisSession = model<AnalysisSessionDocument>('AnalysisSession', analysisSessionSchema);