// Simple bank service that works with localStorage for now
// Later can be enhanced to use Supabase once migrations are applied

export interface BankConfig {
  enabled: boolean;
  environment: 'sandbox' | 'production';
  config: Record<string, string>;
}

export interface BankConfigurations {
  kcb: BankConfig;
  equity: BankConfig;
  cooperative: BankConfig;
  im: BankConfig;
  ncba: BankConfig;
  dtb: BankConfig;
}

const DEFAULT_CONFIG: BankConfigurations = {
  kcb: { enabled: false, environment: 'sandbox', config: {} },
  equity: { enabled: false, environment: 'sandbox', config: {} },
  cooperative: { enabled: false, environment: 'sandbox', config: {} },
  im: { enabled: false, environment: 'sandbox', config: {} },
  ncba: { enabled: false, environment: 'sandbox', config: {} },
  dtb: { enabled: false, environment: 'sandbox', config: {} },
};

export class SimpleBankService {
  private static STORAGE_KEY = 'bank_gateway_configurations';

  static loadConfigurations(): BankConfigurations {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('Error loading bank configurations:', error);
    }
    return DEFAULT_CONFIG;
  }

  static saveConfigurations(configs: BankConfigurations): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(configs));
    } catch (error) {
      console.error('Error saving bank configurations:', error);
      throw error;
    }
  }

  static updateBankConfig(bankCode: keyof BankConfigurations, config: Partial<BankConfig>): void {
    const configs = this.loadConfigurations();
    configs[bankCode] = { ...configs[bankCode], ...config };
    this.saveConfigurations(configs);
  }

  static getBankConfig(bankCode: keyof BankConfigurations): BankConfig {
    const configs = this.loadConfigurations();
    return configs[bankCode];
  }

  // Placeholder payment methods - to be implemented with actual bank APIs
  static async initiateKCBPayment(amount: number, phoneNumber: string): Promise<any> {
    console.log('Initiating KCB Buni payment:', { amount, phoneNumber });
    // Implementation would go here
    return { success: true, transactionId: 'kcb_' + Date.now() };
  }

  static async initiateEquityPayment(amount: number, phoneNumber: string): Promise<any> {
    console.log('Initiating Equity Jenga payment:', { amount, phoneNumber });
    // Implementation would go here
    return { success: true, transactionId: 'equity_' + Date.now() };
  }

  static async initiateCooperativePayment(amount: number, accountNumber: string): Promise<any> {
    console.log('Initiating Cooperative Bank payment:', { amount, accountNumber });
    // Implementation would go here
    return { success: true, transactionId: 'coop_' + Date.now() };
  }

  static async initiateIMPayment(amount: number, accountNumber: string): Promise<any> {
    console.log('Initiating I&M Bank payment:', { amount, accountNumber });
    // Implementation would go here
    return { success: true, transactionId: 'im_' + Date.now() };
  }

  static async initiateNCBAPayment(amount: number, accountNumber: string): Promise<any> {
    console.log('Initiating NCBA payment:', { amount, accountNumber });
    // Implementation would go here
    return { success: true, transactionId: 'ncba_' + Date.now() };
  }

  static async initiateDTBPayment(amount: number, accountNumber: string): Promise<any> {
    console.log('Initiating DTB payment:', { amount, accountNumber });
    // Implementation would go here
    return { success: true, transactionId: 'dtb_' + Date.now() };
  }
}