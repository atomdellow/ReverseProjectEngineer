import { Schema, model, Document } from 'mongoose';
import { Relation as IRelation } from '../core/types';

export interface RelationDocument extends IRelation, Document {}

const relationSchema = new Schema<RelationDocument>({
  type: {
    type: String,
    enum: ['imports', 'invokes', 'owns', 'tests', 'configOf', 'blocks', 'depends'],
    required: true
  },
  sourceId: { type: Schema.Types.ObjectId, required: true },
  sourceType: {
    type: String,
    enum: ['component', 'module', 'artifact'],
    required: true
  },
  targetId: { type: Schema.Types.ObjectId, required: true },
  targetType: {
    type: String,
    enum: ['component', 'module', 'artifact'],
    required: true
  },
  strength: { type: Number, min: 0, max: 1, default: 0.5 },
  sessionId: { type: String, required: true, index: true },
}, {
  timestamps: true,
});

// Indexes for efficient queries
relationSchema.index({ sessionId: 1, type: 1 });
relationSchema.index({ sessionId: 1, sourceId: 1, sourceType: 1 });
relationSchema.index({ sessionId: 1, targetId: 1, targetType: 1 });
relationSchema.index({ 
  sessionId: 1, 
  sourceId: 1, 
  targetId: 1, 
  type: 1 
}, { unique: true });

// Virtual for getting source reference
relationSchema.virtual('source', {
  refPath: function() {
    switch (this.sourceType) {
      case 'component': return 'Component';
      case 'module': return 'Module';
      case 'artifact': return 'Artifact';
      default: return 'Component';
    }
  },
  localField: 'sourceId',
  foreignField: '_id',
  justOne: true
});

// Virtual for getting target reference
relationSchema.virtual('target', {
  refPath: function() {
    switch (this.targetType) {
      case 'component': return 'Component';
      case 'module': return 'Module';
      case 'artifact': return 'Artifact';
      default: return 'Component';
    }
  },
  localField: 'targetId',
  foreignField: '_id',
  justOne: true
});

export const Relation = model<RelationDocument>('Relation', relationSchema);