import { Schema, model, Document } from 'mongoose';
import { JiraSyncJob as IJiraSyncJob } from '../core/types';

export interface JiraSyncJobDocument extends IJiraSyncJob, Document {}

const jiraSyncJobSchema = new Schema<JiraSyncJobDocument>({
  sessionId: { type: String, required: true, index: true },
  mappingId: { type: Schema.Types.ObjectId, ref: 'JiraMapping', required: true },
  type: {
    type: String,
    enum: ['preview', 'apply'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'running', 'completed', 'failed'],
    default: 'pending'
  },
  dryRun: { type: Boolean, default: false },
  startedAt: { type: Date },
  finishedAt: { type: Date },
  progress: {
    total: { type: Number, default: 0 },
    processed: { type: Number, default: 0 },
    created: { type: Number, default: 0 },
    updated: { type: Number, default: 0 },
    linked: { type: Number, default: 0 },
    errors: { type: Number, default: 0 }
  },
  results: [{
    entityId: { type: Schema.Types.ObjectId, required: true },
    entityType: {
      type: String,
      enum: ['component', 'module', 'artifact'],
      required: true
    },
    action: {
      type: String,
      enum: ['create', 'update', 'skip', 'error'],
      required: true
    },
    jiraKey: { type: String },
    jiraId: { type: String },
    fingerprint: { type: String, required: true },
    error: { type: String },
    changes: { type: Schema.Types.Mixed }
  }],
  error: { type: String }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Indexes for efficient queries
jiraSyncJobSchema.index({ sessionId: 1 });
jiraSyncJobSchema.index({ mappingId: 1 });
jiraSyncJobSchema.index({ type: 1, status: 1 });
jiraSyncJobSchema.index({ createdAt: -1 });

// Virtual for duration
jiraSyncJobSchema.virtual('duration').get(function() {
  if (this.startedAt && this.finishedAt) {
    return this.finishedAt.getTime() - this.startedAt.getTime();
  }
  return null;
});

// Virtual for success rate
jiraSyncJobSchema.virtual('successRate').get(function() {
  const { total, errors } = this.progress;
  if (total === 0) return 0;
  return ((total - errors) / total) * 100;
});

export const JiraSyncJob = model<JiraSyncJobDocument>('JiraSyncJob', jiraSyncJobSchema);