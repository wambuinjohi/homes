/**
 * Kopo Kopo OAuth Authentication Helper
 * Handles OAuth 2.0 token generation for Kopo Kopo API
 */

export interface KopokopoTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope?: string;
  created_at?: number;
}

export interface KopokopoAuthError {
  error: string;
  error_description?: string;
}

/**
 * Get OAuth access token from Kopo Kopo
 * @param clientId - Kopo Kopo OAuth Client ID
 * @param clientSecret - Kopo Kopo OAuth Client Secret
 * @param environment - 'sandbox' or 'production'
 * @returns OAuth access token and expiration
 */
export async function getKopokopoAccessToken(
  clientId: string,
  clientSecret: string,
  environment: 'sandbox' | 'production' = 'sandbox'
): Promise<KopokopoTokenResponse> {
  const tokenUrl = environment === 'production'
    ? 'https://api.kopokopo.com/oauth/token'
    : 'https://sandbox.kopokopo.com/oauth/token';

  console.log(`🔑 Requesting Kopo Kopo OAuth token from ${tokenUrl}`);

  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'PropertyManagement/1.0 (OAuth)'
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials'
      })
    });

    const data = await response.json();

    if (!response.ok) {
      const error = data as KopokopoAuthError;
      console.error('❌ Kopo Kopo OAuth error:', error);
      throw new Error(
        `Failed to get Kopo Kopo access token: ${error.error_description || error.error}`
      );
    }

    const tokenData = data as KopokopoTokenResponse;
    console.log('✅ Kopo Kopo access token obtained successfully');
    console.log(`   Token expires in: ${tokenData.expires_in}s`);

    return tokenData;
  } catch (error) {
    console.error('❌ Kopo Kopo OAuth request failed:', error);
    throw error;
  }
}

/**
 * Get Kopo Kopo API base URL based on environment
 */
export function getKopokopoBaseUrl(environment: 'sandbox' | 'production' = 'sandbox'): string {
  return environment === 'production'
    ? 'https://api.kopokopo.com'
    : 'https://sandbox.kopokopo.com';
}
