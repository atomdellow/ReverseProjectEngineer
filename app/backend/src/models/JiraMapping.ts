import { Schema, model, Document } from 'mongoose';
import { JiraMapping as IJiraMapping } from '../core/types';

export interface JiraMappingDocument extends IJiraMapping, Document {}

const jiraMappingSchema = new Schema<JiraMappingDocument>({
  name: { type: String, required: true },
  projectKey: { type: String, required: true },
  isDefault: { type: Boolean, default: false },
  customFields: {
    actualStart: { type: String },
    actualFinish: { type: String },
    originalEstimate: { type: String }
  },
  issueTypes: {
    component: { type: String, required: true, default: 'Epic' },
    module: { type: String, required: true, default: 'Story' },
    artifactDefault: { type: String, required: true, default: 'Task' },
    test: { type: String, required: true, default: 'Test' },
    bug: { type: String, required: true, default: 'Bug' },
    request: { type: String, required: true, default: 'Request' }
  },
  linking: {
    dependency: { type: String, default: 'blocks' },
    ownership: { type: String, default: 'parent' }
  },
  worklog: {
    maxDailySeconds: { type: Number, default: 21600 }, // 6 hours
    bucketMinutes: { type: Number, default: 60 }
  },
  rateLimit: {
    maxPerMinute: { type: Number, default: 45 }
  },
  rules: [{
    condition: {
      entityType: {
        type: String,
        enum: ['component', 'module', 'artifact'],
        required: true
      },
      tagMatches: [{ type: String }],
      pathMatches: [{ type: String }],
      nameMatches: [{ type: String }]
    },
    action: {
      issueType: { type: String, required: true },
      parentRule: { type: String },
      customFields: { type: Schema.Types.Mixed }
    }
  }]
}, {
  timestamps: true,
});

// Indexes for efficient queries
jiraMappingSchema.index({ projectKey: 1 });
jiraMappingSchema.index({ isDefault: 1 });
jiraMappingSchema.index({ name: 1 }, { unique: true });

// Ensure only one default mapping
jiraMappingSchema.pre('save', async function(next) {
  if (this.isDefault) {
    await this.constructor.updateMany(
      { _id: { $ne: this._id } },
      { $set: { isDefault: false } }
    );
  }
  next();
});

export const JiraMapping = model<JiraMappingDocument>('JiraMapping', jiraMappingSchema);