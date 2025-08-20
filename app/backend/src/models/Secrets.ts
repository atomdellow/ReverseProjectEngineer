import { Schema, model, Document } from 'mongoose';
import { Secrets as ISecrets } from '../core/types';

export interface SecretsDocument extends ISecrets, Document {}

const secretsSchema = new Schema<SecretsDocument>({
  name: { type: String, required: true, unique: true },
  encryptedValue: { type: String, required: true },
  description: { type: String },
  expiresAt: { type: Date },
  lastUsed: { type: Date }
}, {
  timestamps: true,
});

// Indexes for efficient queries
secretsSchema.index({ name: 1 }, { unique: true });
secretsSchema.index({ expiresAt: 1 });

// Virtual for checking if expired
secretsSchema.virtual('isExpired').get(function() {
  return this.expiresAt && this.expiresAt < new Date();
});

// Middleware to update lastUsed when secret is accessed
secretsSchema.methods.markAsUsed = function() {
  this.lastUsed = new Date();
  return this.save();
};

export const Secrets = model<SecretsDocument>('Secrets', secretsSchema);