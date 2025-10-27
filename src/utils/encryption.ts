import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * Get encryption key from environment variable
 */
function getEncryptionKey(): Buffer {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
        throw new Error('ENCRYPTION_KEY environment variable is not set');
    }
    
    // Derive a key from the encryption key
    return crypto.pbkdf2Sync(key, 'salt', 100000, KEY_LENGTH, 'sha512');
}

/**
 * Encrypt a string
 * @param text - The text to encrypt
 * @returns Encrypted string in format: salt:iv:tag:encrypted
 */
export function encrypt(text: string): string {
    const key = getEncryptionKey();
    
    // Generate random IV
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    // Encrypt
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Get auth tag
    const tag = cipher.getAuthTag();
    
    // Return format: iv:tag:encrypted
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt a string
 * @param encryptedData - The encrypted string in format: iv:tag:encrypted
 * @returns Decrypted string
 */
export function decrypt(encryptedData: string): string {
    try {
        const key = getEncryptionKey();
        
        // Split the encrypted data
        const parts = encryptedData.split(':');
        if (parts.length !== 3) {
            throw new Error('Invalid encrypted data format');
        }
        
        const iv = Buffer.from(parts[0], 'hex');
        const tag = Buffer.from(parts[1], 'hex');
        const encrypted = parts[2];
        
        // Create decipher
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(tag);
        
        // Decrypt
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    } catch (error) {
        console.error('Decryption error:', error);
        throw new Error('Failed to decrypt data');
    }
}

/**
 * Validate if a string is properly encrypted
 */
export function isValidEncryptedFormat(data: string): boolean {
    const parts = data.split(':');
    return parts.length === 3;
}

