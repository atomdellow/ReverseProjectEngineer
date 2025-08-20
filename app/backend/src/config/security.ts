import crypto from 'crypto';
import { env } from './env';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

export class SecurityService {
  private readonly key: Buffer;

  constructor() {
    // Derive key from APP_SECRET
    this.key = crypto.scryptSync(env.APP_SECRET, 'salt', KEY_LENGTH);
  }

  /**
   * Encrypt a string using AES-256-GCM
   */
  encrypt(text: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipher(ALGORITHM, this.key);
    cipher.setAAD(Buffer.from('rpe-encryption'));
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    
    // Combine iv + tag + encrypted data
    return iv.toString('hex') + tag.toString('hex') + encrypted;
  }

  /**
   * Decrypt a string encrypted with encrypt()
   */
  decrypt(encryptedData: string): string {
    const ivHex = encryptedData.slice(0, IV_LENGTH * 2);
    const tagHex = encryptedData.slice(IV_LENGTH * 2, (IV_LENGTH + TAG_LENGTH) * 2);
    const encrypted = encryptedData.slice((IV_LENGTH + TAG_LENGTH) * 2);
    
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    
    const decipher = crypto.createDecipher(ALGORITHM, this.key);
    decipher.setAAD(Buffer.from('rpe-encryption'));
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Generate a secure random string
   */
  generateSecret(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Hash a password using bcrypt-style hashing
   */
  async hashPassword(password: string): Promise<string> {
    const bcrypt = await import('bcryptjs');
    return bcrypt.hash(password, 12);
  }

  /**
   * Verify a password against a hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    const bcrypt = await import('bcryptjs');
    return bcrypt.compare(password, hash);
  }
}

export const securityService = new SecurityService();