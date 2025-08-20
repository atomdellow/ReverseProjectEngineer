import { Schema, model, Document } from 'mongoose';
import { Module as IModule } from '../core/types';

export interface ModuleDocument extends IModule, Document {}

const moduleSchema = new Schema<ModuleDocument>({
  name: { type: String, required: true },
  description: { type: String },
  path: { type: String, required: true },
  type: { type: String, default: 'module' },
  componentId: { type: Schema.Types.ObjectId, ref: 'Component', required: true },
  artifacts: [{ type: Schema.Types.ObjectId, ref: 'Artifact' }],
  dependencies: [{ type: Schema.Types.ObjectId, ref: 'Module' }],
  firstSeenAt: { type: Date, required: true },
  lastChangedAt: { type: Date, required: true },
  commitCount: { type: Number, default: 0 },
  tags: [{ type: String }],
  sessionId: { type: String, required: true, index: true },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Indexes for efficient queries
moduleSchema.index({ sessionId: 1, path: 1 }, { unique: true });
moduleSchema.index({ sessionId: 1, componentId: 1 });
moduleSchema.index({ componentId: 1 });
moduleSchema.index({ tags: 1 });
moduleSchema.index({ lastChangedAt: -1 });

// Virtual for related data
moduleSchema.virtual('artifactCount').get(function() {
  return this.artifacts?.length || 0;
});

export const Module = model<ModuleDocument>('Module', moduleSchema);