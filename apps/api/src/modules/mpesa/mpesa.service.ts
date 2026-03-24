import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MpesaService {
  private readonly apiKey: string;
  private readonly publicKey: string;
  private readonly serviceProviderCode: string;
  private readonly apiUrl: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('MPESA_API_KEY', '');
    this.publicKey = this.config.get<string>('MPESA_PUBLIC_KEY', '');
    this.serviceProviderCode = this.config.get<string>('MPESA_SERVICE_PROVIDER_CODE', '');
    this.apiUrl = this.config.get<string>('MPESA_API_URL', 'https://api.sandbox.vm.co.mz');
  }

  isConfigured(): boolean {
    return !!(this.apiKey && this.publicKey && this.serviceProviderCode);
  }

  async initiatePayment(input: {
    phoneNumber: string;
    amount: number;
    reference: string;
    thirdPartyReference: string;
  }) {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'M-Pesa not configured. Set MPESA_API_KEY, MPESA_PUBLIC_KEY, and MPESA_SERVICE_PROVIDER_CODE.',
      };
    }

    try {
      const token = this.generateToken();

      const response = await fetch(`${this.apiUrl}/ipg/v1x/c2bPayment/singleStage/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Origin': '*',
        },
        body: JSON.stringify({
          input_TransactionReference: input.reference,
          input_CustomerMSISDN: input.phoneNumber,
          input_Amount: String(input.amount),
          input_ThirdPartyReference: input.thirdPartyReference,
          input_ServiceProviderCode: this.serviceProviderCode,
        }),
      });

      const data = await response.json();
      return {
        success: data.output_ResponseCode === 'INS-0',
        transactionId: data.output_TransactionID,
        conversationId: data.output_ConversationID,
        responseCode: data.output_ResponseCode,
        responseDescription: data.output_ResponseDesc,
      };
    } catch (error) {
      console.error('M-Pesa error:', error);
      return { success: false, error: 'M-Pesa request failed' };
    }
  }

  async checkStatus(transactionId: string) {
    if (!this.isConfigured()) {
      return { success: false, error: 'M-Pesa not configured' };
    }

    // Real status check would query M-Pesa API
    return { success: true, status: 'pending', transactionId };
  }

  private generateToken(): string {
    // In production, encrypt API key with public key using RSA
    // For now, return the API key directly (sandbox mode)
    return this.apiKey;
  }
}
