/**
 * Utility functions for API calls
 */

/**
 * Get common API configuration from environment variables
 */
export const getApiConfig = () => {
  const baseUrl = process.env.API_BASE_URL || "https://mymediset-xba-dev-eu10.dev.mymediset.cloud";
  const authToken = process.env.AUTH_TOKEN || "";
  const authHeaderName = process.env.AUTH_HEADER_NAME || "x-approuter-authorization";
  
  return {
    baseUrl,
    authToken,
    authHeaderName
  };
};

/**
 * Make an authenticated API call
 */
export const fetchApi = async <T>(endpoint: string, options: RequestInit = {}): Promise<T> => {
  const { baseUrl, authToken, authHeaderName } = getApiConfig();
  
  const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
  
  const headers = new Headers(options.headers);
  headers.set(authHeaderName, authToken);
  
  const response = await fetch(url, {
    ...options,
    headers
  });
  
  if (!response.ok) {
    throw new Error(`API request failed with status: ${response.status}`);
  }
  
  return await response.json();
};

/**
 * Make an API GET request with authentication and query parameters
 */
export const fetchApiWithParams = async <T>(
  endpoint: string, 
  params: Record<string, string | number | boolean | undefined> = {},
  options: RequestInit = {}
): Promise<T> => {
  // Remove undefined values and convert to string
  const cleanParams = Object.entries(params)
    .filter(([_, value]) => value !== undefined)
    .reduce((acc, [key, value]) => {
      acc[key] = String(value);
      return acc;
    }, {} as Record<string, string>);
  
  const queryParams = new URLSearchParams(cleanParams);
  const queryString = queryParams.toString();
  
  const fullEndpoint = queryString ? `${endpoint}?${queryString}` : endpoint;
  
  return fetchApi<T>(fullEndpoint, {
    method: 'GET',
    ...options
  });
}; 