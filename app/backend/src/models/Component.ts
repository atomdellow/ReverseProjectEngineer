import { Schema, model, Document } from 'mongoose';
import { Component as IComponent } from '../core/types';

export interface ComponentDocument extends IComponent, Document {}

const componentSchema = new Schema<ComponentDocument>({
  name: { type: String, required: true },
  description: { type: String },
  path: { type: String, required: true },
  type: { type: String, default: 'component' },
  modules: [{ type: Schema.Types.ObjectId, ref: 'Module' }],
  artifacts: [{ type: Schema.Types.ObjectId, ref: 'Artifact' }],
  dependencies: [{ type: Schema.Types.ObjectId, ref: 'Component' }],
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
componentSchema.index({ sessionId: 1, path: 1 }, { unique: true });
componentSchema.index({ sessionId: 1, name: 1 });
componentSchema.index({ tags: 1 });
componentSchema.index({ lastChangedAt: -1 });

// Virtual for related data
componentSchema.virtual('moduleCount').get(function() {
  return this.modules?.length || 0;
});

componentSchema.virtual('artifactCount').get(function() {
  return this.artifacts?.length || 0;
});

export const Component = model<ComponentDocument>('Component', componentSchema);