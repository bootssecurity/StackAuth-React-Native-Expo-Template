import AsyncStorage from '@react-native-async-storage/async-storage';

// Stack Auth configuration for React Native
export const STACK_CONFIG = {
  projectId: process.env.EXPO_PUBLIC_STACK_PROJECT_ID ,
  publishableClientKey: process.env.EXPO_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY ,
  serverSecretKey: process.env.STACK_SERVER_SECRET_KEY ,
  baseUrl: process.env.EXPO_PUBLIC_STACK_BASE_URL ,
};

// Token storage interface using AsyncStorage
export class StackTokenStorage {
  private static ACCESS_TOKEN_KEY = '@stack_auth_access_token';
  private static REFRESH_TOKEN_KEY = '@stack_auth_refresh_token';

  static async getAccessToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(this.ACCESS_TOKEN_KEY);
    } catch (error) {
      console.error('Error getting access token:', error);
      return null;
    }
  }

  static async setAccessToken(token: string): Promise<void> {
    try {
      await AsyncStorage.setItem(this.ACCESS_TOKEN_KEY, token);
    } catch (error) {
      console.error('Error setting access token:', error);
    }
  }

  static async getRefreshToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(this.REFRESH_TOKEN_KEY);
    } catch (error) {
      console.error('Error getting refresh token:', error);
      return null;
    }
  }

  static async setRefreshToken(token: string): Promise<void> {
    try {
      await AsyncStorage.setItem(this.REFRESH_TOKEN_KEY, token);
    } catch (error) {
      console.error('Error setting refresh token:', error);
    }
  }

  static async clearTokens(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([this.ACCESS_TOKEN_KEY, this.REFRESH_TOKEN_KEY]);
    } catch (error) {
      console.error('Error clearing tokens:', error);
    }
  }
}

// Stack Auth API client
export class StackAuthClient {
  private baseUrl: string;
  private projectId: string;
  private publishableClientKey: string;
  private serverSecretKey: string;

  constructor() {
    this.baseUrl = STACK_CONFIG.baseUrl;
    this.projectId = STACK_CONFIG.projectId;
    this.publishableClientKey = STACK_CONFIG.publishableClientKey;
    this.serverSecretKey = STACK_CONFIG.serverSecretKey;
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const accessToken = await StackTokenStorage.getAccessToken();
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Stack-Access-Type': 'client',
      'X-Stack-Project-Id': this.projectId,
      'X-Stack-Publishable-Client-Key': this.publishableClientKey,
      ...options.headers as Record<string, string>,
    };

    if (accessToken) {
      headers['X-Stack-Access-Token'] = accessToken;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    // Handle token refresh if access token is expired
    if (response.status === 401) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        // Retry the request with new token
        const newAccessToken = await StackTokenStorage.getAccessToken();
        if (newAccessToken) {
          headers['X-Stack-Access-Token'] = newAccessToken;
          return fetch(`${this.baseUrl}${endpoint}`, {
            ...options,
            headers,
          });
        }
      }
    }

    return response;
  }

  private async refreshAccessToken(): Promise<boolean> {
    try {
      const refreshToken = await StackTokenStorage.getRefreshToken();
      if (!refreshToken) return false;

      const response = await fetch(`${this.baseUrl}/auth/sessions/current/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Stack-Access-Type': 'client',
          'X-Stack-Project-Id': this.projectId,
          'X-Stack-Publishable-Client-Key': this.publishableClientKey,
          'X-Stack-Refresh-Token': refreshToken,
        },
      });

      if (response.ok) {
        const data = await response.json();
        await StackTokenStorage.setAccessToken(data.access_token);
        return true;
      }
    } catch (error) {
      console.error('Error refreshing token:', error);
    }
    return false;
  }

  async signInWithPassword(email: string, password: string): Promise<{ success: boolean; error?: string; user_id?: string }> {
    console.log('StackAuth: signInWithPassword called with email:', email);
    console.log('StackAuth: Using baseUrl:', this.baseUrl);
    console.log('StackAuth: Using projectId:', this.projectId);
    
    try {
      const requestBody = { email, password };
      console.log('StackAuth: Request body:', requestBody);
      
      const response = await this.makeRequest('/auth/password/sign-in', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      console.log('StackAuth: Response status:', response.status);
      console.log('StackAuth: Response headers:', Object.fromEntries(response.headers.entries()));

      if (response.ok) {
        const data = await response.json();
        console.log('StackAuth: Response data:', data);
        
        if (data.access_token) {
           console.log('StackAuth: Sign in successful, storing tokens');
           await StackTokenStorage.setAccessToken(data.access_token);
         }
         if (data.refresh_token) {
           await StackTokenStorage.setRefreshToken(data.refresh_token);
         }
         return { success: true, user_id: data.user_id };
      } else {
        const errorData = await response.json();
        console.log('StackAuth: Sign in failed:', errorData.message || 'Unknown error');
        return { success: false, error: errorData.message || 'Sign in failed' };
      }
    } catch (error) {
      console.error('StackAuth: Sign in error:', error);
      return { success: false, error: 'Network error' };
    }
  }

  async signUpWithPassword(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await this.makeRequest('/auth/password/sign-up', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.access_token) {
          await StackTokenStorage.setAccessToken(data.access_token);
        }
        if (data.refresh_token) {
          await StackTokenStorage.setRefreshToken(data.refresh_token);
        }
        return { success: true };
      } else {
        const errorData = await response.json();
        return { success: false, error: errorData.message || 'Sign up failed' };
      }
    } catch (error) {
      return { success: false, error: 'Network error' };
    }
  }

  async getCurrentUser(): Promise<any> {
    console.log('StackAuth: getCurrentUser called');
    try {
      console.log('StackAuth: Making request to /users/me');
      const response = await this.makeRequest('/users/me');
      console.log('StackAuth: getCurrentUser response status:', response.status);
      
      if (response.ok) {
        const apiData = await response.json();
        console.log('StackAuth: getCurrentUser response data:', apiData);
        
        // Map API response to our User interface
        const userData = {
          id: apiData.id,
          email: apiData.primary_email,
          displayName: apiData.display_name || apiData.primary_email?.split('@')[0],
          profile_image_url: apiData.profile_image_url
        };
        
        console.log('StackAuth: Mapped user data:', userData);
        return userData;
      } else {
        const errorData = await response.json();
        console.log('StackAuth: getCurrentUser failed:', errorData);
      }
    } catch (error) {
      console.error('StackAuth: Error getting current user:', error);
    }
    return null;
  }

  async getTeamPermissions(teamId: string, userId: string = 'me'): Promise<{ success: boolean; permissions?: any[]; error?: string }> {
    console.log('StackAuth: getTeamPermissions called with teamId:', teamId, 'userId:', userId);
    try {
      const response = await this.makeRequest(`/team-permissions?team_id=${teamId}&user_id=${userId}`);
      console.log('StackAuth: getTeamPermissions response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('StackAuth: getTeamPermissions response data:', data);
        return { success: true, permissions: data.items || [] };
      } else {
        const errorData = await response.json();
        console.log('StackAuth: getTeamPermissions failed:', errorData);
        return { success: false, error: errorData.error || 'Failed to fetch permissions' };
      }
    } catch (error) {
      console.error('StackAuth: Error fetching team permissions:', error);
      return { success: false, error: 'Network error while fetching permissions' };
    }
  }

  async getTeamMemberProfiles(teamId: string): Promise<{ success: boolean; profiles?: any[]; error?: string }> {
    console.log('StackAuth: getTeamMemberProfiles called with teamId:', teamId);
    try {
      const response = await fetch(`${this.baseUrl}/team-member-profiles?team_id=${teamId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-stack-publishable-client-key': this.publishableClientKey,
          'x-stack-project-id': this.projectId,
          'x-stack-access-type': 'server',
          'x-stack-secret-server-key': this.serverSecretKey
        }
      });
      console.log('StackAuth: getTeamMemberProfiles response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('StackAuth: getTeamMemberProfiles response data:', data);
        return { success: true, profiles: data.items || [] };
      } else {
        const errorData = await response.json();
        console.log('StackAuth: getTeamMemberProfiles failed:', errorData);
        return { success: false, error: errorData.error || 'Failed to fetch team member profiles' };
      }
    } catch (error) {
      console.error('StackAuth: Error fetching team member profiles:', error);
      return { success: false, error: 'Network error while fetching team member profiles' };
    }
  }

  async getUserById(userId: string): Promise<{ success: boolean; user?: any; error?: string }> {
    console.log('StackAuth: getUserById called with userId:', userId);
    try {
      console.log('StackAuth: Making request to /users/' + userId);
      const response = await this.makeRequest(`/users/${userId}`);
      console.log('StackAuth: getUserById response status:', response.status);
      
      if (response.ok) {
        const apiData = await response.json();
        console.log('StackAuth: getUserById response data:', apiData);
        
        // Map API response to our User interface
        const userData = {
          id: apiData.id,
          email: apiData.primary_email,
          displayName: apiData.display_name || apiData.primary_email?.split('@')[0],
          profile_image_url: apiData.profile_image_url
        };
        
        console.log('StackAuth: Mapped getUserById data:', userData);
        return { success: true, user: userData };
      } else {
        const errorData = await response.json();
        console.log('StackAuth: getUserById failed:', errorData);
        return { success: false, error: errorData.error || 'Failed to fetch user' };
      }
    } catch (error) {
      console.error('StackAuth: Error fetching user by ID:', error);
      return { success: false, error: 'Network error while fetching user' };
    }
  }

  async signOut(): Promise<void> {
    try {
      await this.makeRequest('/auth/sessions/current', {
        method: 'DELETE',
      });
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      await StackTokenStorage.clearTokens();
    }
  }

  async isAuthenticated(): Promise<boolean> {
    const accessToken = await StackTokenStorage.getAccessToken();
    if (!accessToken) return false;

    try {
      const user = await this.getCurrentUser();
      return !!user;
    } catch {
      return false;
    }
  }

  async getTeams(): Promise<{ success: boolean; teams?: any[]; error?: string }> {
    try {
      const response = await this.makeRequest('/teams?user_id=me', {
        method: 'GET',
      });

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          teams: data.items || [],
        };
      } else {
        const errorData = await response.json();
        return {
          success: false,
          error: errorData.error || 'Failed to fetch teams',
        };
      }
    } catch (error) {
      console.error('Error fetching teams:', error);
      return {
        success: false,
        error: 'Network error while fetching teams',
      };
    }
  }

  async getTeam(teamId: string): Promise<{ success: boolean; team?: any; error?: string }> {
    try {
      const response = await this.makeRequest(`/teams/${teamId}`, {
        method: 'GET',
      });

      if (response.ok) {
        const team = await response.json();
        return { success: true, team };
      } else {
        const errorData = await response.json();
        return { success: false, error: errorData.error || 'Failed to fetch team' };
      }
    } catch (error) {
      console.error('Error fetching team:', error);
      return { success: false, error: 'Network error while fetching team' };
    }
  }

  async updateTeam(teamId: string, updates: { display_name?: string; profile_image_url?: string; client_metadata?: any }): Promise<{ success: boolean; team?: any; error?: string }> {
    try {
      const response = await this.makeRequest(`/teams/${teamId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        const team = await response.json();
        return { success: true, team };
      } else {
        const errorData = await response.json();
        return { success: false, error: errorData.error || 'Failed to update team' };
      }
    } catch (error) {
      console.error('Error updating team:', error);
      return { success: false, error: 'Network error while updating team' };
    }
  }

  async deleteTeam(teamId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const accessToken = await StackTokenStorage.getAccessToken();
      
      const headers: Record<string, string> = {
        'X-Stack-Access-Type': 'client',
        'X-Stack-Project-Id': this.projectId,
        'X-Stack-Publishable-Client-Key': this.publishableClientKey,
      };

      if (accessToken) {
        headers['X-Stack-Access-Token'] = accessToken;
      }

      const response = await fetch(`${this.baseUrl}/teams/${teamId}`, {
        method: 'DELETE',
        headers,
      });

      // Handle token refresh if access token is expired
      if (response.status === 401) {
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          const newAccessToken = await StackTokenStorage.getAccessToken();
          if (newAccessToken) {
            headers['X-Stack-Access-Token'] = newAccessToken;
            const retryResponse = await fetch(`${this.baseUrl}/teams/${teamId}`, {
              method: 'DELETE',
              headers,
            });
            
            if (retryResponse.ok) {
              return { success: true };
            } else {
              const errorData = await retryResponse.json();
              return { success: false, error: errorData.error || 'Failed to delete team' };
            }
          }
        }
      }

      if (response.ok) {
        return { success: true };
      } else {
        const errorData = await response.json();
        return { success: false, error: errorData.error || 'Failed to delete team' };
      }
    } catch (error) {
      console.error('Error deleting team:', error);
      return { success: false, error: 'Network error while deleting team' };
    }
  }

  async getTeamMembers(teamId: string): Promise<{ success: boolean; members?: any[]; error?: string }> {
    try {
      const response = await this.makeRequest(`/team-member-profiles?team_id=${teamId}`, {
        method: 'GET',
      });

      if (response.ok) {
        const data = await response.json();
        return { success: true, members: data.items || [] };
      } else {
        const errorData = await response.json();
        return { success: false, error: errorData.error || 'Failed to fetch team members' };
      }
    } catch (error) {
      console.error('Error fetching team members:', error);
      return { success: false, error: 'Network error while fetching team members' };
    }
  }

  async removeTeamMember(teamId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await this.makeRequest(`/team-memberships/${teamId}/${userId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        return { success: true };
      } else {
        const errorData = await response.json();
        return { success: false, error: errorData.error || 'Failed to remove team member' };
      }
    } catch (error) {
      console.error('Error removing team member:', error);
      return { success: false, error: 'Network error while removing team member' };
    }
  }

  async sendTeamInvitation(teamId: string, email: string, callbackUrl: string): Promise<{ success: boolean; invitationId?: string; error?: string }> {
    try {
      const response = await this.makeRequest('/team-invitations/send-code', {
        method: 'POST',
        body: JSON.stringify({
          team_id: teamId,
          email,
          callback_url: callbackUrl,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return { success: true, invitationId: data.id };
      } else {
        const errorData = await response.json();
        return { success: false, error: errorData.error || 'Failed to send invitation' };
      }
    } catch (error) {
      console.error('Error sending team invitation:', error);
      return { success: false, error: 'Network error while sending invitation' };
    }
  }

  async getTeamInvitations(teamId: string): Promise<{ success: boolean; invitations?: any[]; error?: string }> {
    try {
      const response = await this.makeRequest(`/team-invitations?team_id=${teamId}`, {
        method: 'GET',
      });

      if (response.ok) {
        const data = await response.json();
        return { success: true, invitations: data.items || [] };
      } else {
        const errorData = await response.json();
        return { success: false, error: errorData.error || 'Failed to fetch invitations' };
      }
    } catch (error) {
      console.error('Error fetching team invitations:', error);
      return { success: false, error: 'Network error while fetching invitations' };
    }
  }

  async deleteTeamInvitation(invitationId: string, teamId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const accessToken = await StackTokenStorage.getAccessToken();
      
      const headers: Record<string, string> = {
        'X-Stack-Access-Type': 'client',
        'X-Stack-Project-Id': this.projectId,
        'X-Stack-Publishable-Client-Key': this.publishableClientKey,
      };

      if (accessToken) {
        headers['X-Stack-Access-Token'] = accessToken;
      }

      const response = await fetch(`${this.baseUrl}/team-invitations/${invitationId}?team_id=${teamId}`, {
        method: 'DELETE',
        headers,
      });

      // Handle token refresh if access token is expired
      if (response.status === 401) {
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          const newAccessToken = await StackTokenStorage.getAccessToken();
          if (newAccessToken) {
            headers['X-Stack-Access-Token'] = newAccessToken;
            const retryResponse = await fetch(`${this.baseUrl}/team-invitations/${invitationId}?team_id=${teamId}`, {
              method: 'DELETE',
              headers,
            });
            
            if (retryResponse.ok) {
              return { success: true };
            } else {
              const errorData = await retryResponse.json();
              return { success: false, error: errorData.error || 'Failed to delete invitation' };
            }
          }
        }
      }

      if (response.ok) {
        return { success: true };
      } else {
        const errorData = await response.json();
        return { success: false, error: errorData.error || 'Failed to delete invitation' };
      }
    } catch (error) {
      console.error('Error deleting team invitation:', error);
      return { success: false, error: 'Network error while deleting invitation' };
    }
  }

  async updateTeamMemberProfile(teamId: string, updates: { display_name?: string; profile_image_url?: string }): Promise<{ success: boolean; profile?: any; error?: string }> {
    try {
      const response = await this.makeRequest(`/team-member-profiles/${teamId}/me`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        const profile = await response.json();
        return { success: true, profile };
      } else {
        const errorData = await response.json();
        return { success: false, error: errorData.error || 'Failed to update member profile' };
      }
    } catch (error) {
      console.error('Error updating team member profile:', error);
      return { success: false, error: 'Network error while updating member profile' };
    }
  }
}

// Export singleton instance
export const stackAuthClient = new StackAuthClient();