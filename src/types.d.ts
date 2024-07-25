// Describes metadata related to a provider based on EIP-6963.
interface EIP6963ProviderInfo {
    walletId: string
    uuid: string
    name: string
    icon: string
  }
  
  // Represents the structure of a provider based on EIP-1193.
  interface EIP1193Provider {
    isStatus?: boolean
    host?: string
    path?: string
    sendAsync?: (request: { method: string, params?: Array<unknown> }, callback: (error: Error | null, response: unknown) => void) => void
    send?: (request: { method: string, params?: Array<unknown> }, callback: (error: Error | null, response: unknown) => void) => void
    request: (request: { method: string, params?: Array<unknown> }) => Promise<unknown>
  }
  
  // Combines the provider's metadata with an actual provider object, creating a complete picture of a
  // wallet provider at a glance.
  interface EIP6963ProviderDetail {
    info: EIP6963ProviderInfo
    provider: EIP1193Provider
  }
  
  // Represents the structure of an event dispatched by a wallet to announce its presence based on EIP-6963.
  type EIP6963AnnounceProviderEvent = {
    detail:{
      info: EIP6963ProviderInfo
      provider: EIP1193Provider
    }
  }
  
  // An error object with optional properties, commonly encountered when handling eth_requestAccounts errors.
  interface MMError {
    code?: string
    message?: string
  }

  interface Debt {
    name: string;
    symbol: string;
    rating?: string;
    vendor: string; /* This should be an address */
    coupons: any[];
    minRate?: string
  }
  
  interface Coupon {
    start_date: bigint;
    cutoff_date: bigint;
    payment_date: bigint;
    annual_interest_rate: bigint;
    par_value: number;
    actual_payment_date: bigint;
    status: number;
  }
  

  interface Paid{
    tx?: string;
    when: number;
    who: string;
    couponIndex: any; //Could be string, could be bn
    amount: any; //Could be string, could be bn
  }