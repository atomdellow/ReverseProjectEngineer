import { Schema, model, Document } from 'mongoose';
import { Artifact as IArtifact } from '../core/types';

export interface ArtifactDocument extends IArtifact, Document {}

const artifactSchema = new Schema<ArtifactDocument>({
  name: { type: String, required: true },
  path: { type: String, required: true },
  type: { type: String, default: 'artifact' },
  language: { type: String, required: true },
  role: {
    type: String,
    enum: ['controller', 'service', 'model', 'test', 'config', 'view', 'component', 'utility', 'unknown'],
    default: 'unknown'
  },
  moduleId: { type: Schema.Types.ObjectId, ref: 'Module' },
  componentId: { type: Schema.Types.ObjectId, ref: 'Component' },
  size: { type: Number, required: true },
  lines: { type: Number, required: true },
  dependencies: [{ type: Schema.Types.ObjectId, ref: 'Artifact' }],
  exports: [{ type: String }],
  imports: [{ type: String }],
  firstSeenAt: { type: Date, required: true },
  lastChangedAt: { type: Date, required: true },
  commitCount: { type: Number, default: 0 },
  sessionId: { type: String, required: true, index: true },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Indexes for efficient queries
artifactSchema.index({ sessionId: 1, path: 1 }, { unique: true });
artifactSchema.index({ sessionId: 1, moduleId: 1 });
artifactSchema.index({ sessionId: 1, componentId: 1 });
artifactSchema.index({ language: 1 });
artifactSchema.index({ role: 1 });
artifactSchema.index({ lastChangedAt: -1 });

// Text index for searching exports and imports
artifactSchema.index({ 
  name: 'text', 
  exports: 'text', 
  imports: 'text' 
});

// Virtual for file extension
artifactSchema.virtual('extension').get(function() {
  const path = require('path');
  return path.extname(this.path);
});

export const Artifact = model<ArtifactDocument>('Artifact', artifactSchema);