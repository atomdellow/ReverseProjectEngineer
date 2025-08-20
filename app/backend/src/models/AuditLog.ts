import { Schema, model, Document } from 'mongoose';
import { AuditLog as IAuditLog } from '../core/types';

export interface AuditLogDocument extends IAuditLog, Document {}

const auditLogSchema = new Schema<AuditLogDocument>({
  userId: { type: String },
  action: { type: String, required: true },
  entityType: { type: String, required: true },
  entityId: { type: String, required: true },
  details: { type: Schema.Types.Mixed, required: true },
  timestamp: { type: Date, default: Date.now },
  ip: { type: String },
  userAgent: { type: String }
}, {
  timestamps: true,
});

// Indexes for efficient queries and TTL
auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1 });
auditLogSchema.index({ userId: 1 });
auditLogSchema.index({ action: 1 });

// TTL index to automatically remove old audit logs after 1 year
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 31536000 });

export const AuditLog = model<AuditLogDocument>('AuditLog', auditLogSchema);