const crypto = require('crypto');
const sss = require('shamirs-secret-sharing');

const ALGORITHM = 'aes-256-ecb';
const KEY_LENGTH = 32;

class EncryptionService {
  static generateKey() {
    return crypto.randomBytes(KEY_LENGTH);
  }

  static encrypt(data, key) {
    try {
      if (key.length !== KEY_LENGTH) {
        throw new Error('Invalid key length for encryption');
      }
      const cipher = crypto.createCipheriv(ALGORITHM, key, null);
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return encrypted;
    } catch (error) {
      console.error('Encryption error:', error);
      throw error;
    }
  }

  static decrypt(encryptedData, key) {
    try {
      // Ensure key is a Buffer and has correct length
      let finalKey = Buffer.isBuffer(key) ? key : Buffer.from(key);
      
      if (finalKey.length !== KEY_LENGTH) {
        console.log(`Adjusting key length from ${finalKey.length} to ${KEY_LENGTH} bytes`);
        const adjustedKey = Buffer.alloc(KEY_LENGTH);
        finalKey.copy(adjustedKey, 0, 0, Math.min(finalKey.length, KEY_LENGTH));
        finalKey = adjustedKey;
      }

      const decipher = crypto.createDecipheriv(ALGORITHM, finalKey, null);
      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      console.log('Decryption error:', error);
      throw error;
    }
  }

  static generateKeyShares(key, numShares, threshold) {
    return sss.split(key, { shares: numShares, threshold });
  }

  static combineKeyShares(shares) {
    try {
      // Take only first 2 shares since threshold is 2
      const requiredShares = shares.slice(0, 2);
      console.log('Using shares:', requiredShares);
      
      // Combine shares
      const combinedKey = sss.combine(requiredShares);
      console.log('Raw combined key length:', combinedKey.length);
      
      // Convert combined key to Buffer and ensure correct length
      const finalKey = Buffer.alloc(KEY_LENGTH);
      Buffer.from(combinedKey).copy(finalKey, 0, 0, KEY_LENGTH);
      
      return finalKey;
    } catch (error) {
      console.error('Error combining shares:', error);
      throw error;
    }
  }
}

module.exports = EncryptionService;
