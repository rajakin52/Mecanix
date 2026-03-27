import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * Hash chain generator for AGT compliance.
 * Implements RSA-SHA1 digital signature per Decreto Executivo 74/19.
 *
 * Hash input: "{InvoiceDate};{SystemEntryDate};{DocumentNumber};{GrossTotal};{PreviousHash}"
 */
@Injectable()
export class HashService {
  private readonly logger = new Logger('HashService');

  /**
   * Generate the document hash using RSA-SHA1 signature.
   *
   * @param invoiceDate - Document date (YYYY-MM-DD)
   * @param systemEntryDate - System entry timestamp (YYYY-MM-DDTHH:mm:ss)
   * @param documentNumber - SAF-T document number (e.g. "FT MECANIX/1")
   * @param grossTotal - Gross total with 2 decimal places
   * @param previousHash - Hash of previous document in same series (empty for first)
   * @param privateKeyPem - RSA private key in PEM format
   * @returns Base64-encoded RSA-SHA1 signature
   */
  generateHash(
    invoiceDate: string,
    systemEntryDate: string,
    documentNumber: string,
    grossTotal: number,
    previousHash: string,
    privateKeyPem: string,
  ): string {
    // Build the plain text input per Decreto Executivo 74/19
    const plainText = [
      invoiceDate,
      systemEntryDate,
      documentNumber,
      grossTotal.toFixed(2),
      previousHash,
    ].join(';');

    this.logger.debug(`Hash input: "${plainText}"`);

    try {
      const sign = crypto.createSign('SHA1');
      sign.update(plainText);
      sign.end();

      const signature = sign.sign(privateKeyPem, 'base64');
      return signature;
    } catch (err) {
      this.logger.error(`Hash generation failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      throw err;
    }
  }

  /**
   * Extract the short hash (first 4 characters) for display on printed documents.
   */
  shortHash(fullHash: string): string {
    return fullHash.substring(0, 4);
  }

  /**
   * Generate a self-signed RSA key pair for testing/development.
   * In production, keys are issued by AGT.
   */
  generateTestKeyPair(): { publicKey: string; privateKey: string } {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    return { publicKey, privateKey };
  }

  /**
   * Verify a hash against the original data (for SAF-T validation).
   */
  verifyHash(
    invoiceDate: string,
    systemEntryDate: string,
    documentNumber: string,
    grossTotal: number,
    previousHash: string,
    hash: string,
    publicKeyPem: string,
  ): boolean {
    const plainText = [
      invoiceDate,
      systemEntryDate,
      documentNumber,
      grossTotal.toFixed(2),
      previousHash,
    ].join(';');

    try {
      const verify = crypto.createVerify('SHA1');
      verify.update(plainText);
      verify.end();
      return verify.verify(publicKeyPem, hash, 'base64');
    } catch {
      return false;
    }
  }
}
