// API client for backend communication
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    // Load token from localStorage on client side
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('authToken');
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          error: data.error || 'Request failed',
          message: data.message || 'An error occurred',
        };
      }

      return { data };
    } catch (error) {
      return {
        error: 'Network error',
        message: error instanceof Error ? error.message : 'Failed to connect to server',
      };
    }
  }

  setToken(token: string | null) {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('authToken', token);
      } else {
        localStorage.removeItem('authToken');
      }
    }
  }

  async register(email: string, password: string, name?: string) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
  }

  async login(email: string, password: string) {
    const result = await this.request<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (result.data?.token) {
      this.setToken(result.data.token);
    }

    return result;
  }

  async logout() {
    this.setToken(null);
  }

  async getCurrentUser() {
    return this.request<{ user: any }>('/auth/me');
  }

  async googleStatus() {
    return this.request<{
      connected: boolean
      businessName?: string
      connectedAt?: string
      lastSyncedAt?: string
      connectionId?: string
    }>('/google/status');
  }

  async googleDisconnect() {
    return this.request<{ success: boolean; message: string }>('/google/disconnect', {
      method: 'POST',
    });
  }

  async syncReviews() {
    return this.request<{
      success: boolean
      message: string
      stats: { totalFetched: number; newReviews: number; updatedReviews: number }
    }>('/google/sync-reviews', {
      method: 'POST',
    });
  }

  async getReviews(params?: {
    limit?: number
    offset?: number
    rating?: number
    responded?: boolean
  }) {
    const queryParams = new URLSearchParams()
    
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    if (params?.offset) queryParams.append('offset', params.offset.toString())
    if (params?.rating) queryParams.append('rating', params.rating.toString())
    if (params?.responded !== undefined) queryParams.append('responded', params.responded.toString())

    const query = queryParams.toString()
    return this.request<{
      reviews: any[]
      total: number
      limit: number
      offset: number
      hasMore: boolean
    }>(`/google/reviews${query ? '?' + query : ''}`);
  }

  // Response Generation APIs (Phase 3)
  
  async generateResponse(reviewId: string) {
    return this.request<{
      success: boolean
      response: {
        id: string
        response_text: string
        generated_at: string
        status: string
      }
      alreadyExists?: boolean
      message?: string
      rateLimit?: {
        remaining: number
      }
    }>('/responses/generate', {
      method: 'POST',
      body: JSON.stringify({ reviewId }),
    });
  }

  async updateResponse(responseId: string, responseText: string) {
    return this.request<{
      success: boolean
      response: {
        id: string
        response_text: string
        generated_at: string
        status: string
      }
    }>(`/responses/${responseId}`, {
      method: 'PUT',
      body: JSON.stringify({ responseText }),
    });
  }

  async approveResponse(responseId: string) {
    return this.request<{
      success: boolean
      message: string
      response: {
        id: string
        status: string
        postedAt: string
      }
    }>(`/responses/${responseId}/approve`, {
      method: 'POST',
    });
  }

  async deleteResponse(responseId: string) {
    return this.request<{
      success: boolean
      message: string
    }>(`/responses/${responseId}`, {
      method: 'DELETE',
    });
  }

  async getResponse(reviewId: string) {
    return this.request<{
      response: {
        id: string
        response_text: string
        generated_at: string
        approved_at?: string
        posted_at?: string
        status: string
      }
    }>(`/responses/${reviewId}`);
  }
}

export const api = new ApiClient(API_BASE_URL);
export default api;
