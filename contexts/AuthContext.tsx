import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { stackAuthClient, StackTokenStorage } from '../lib/stack-auth';

interface User {
  id: string;
  email: string;
  displayName?: string;
  profile_image_url?: string;
  // Add other user properties as needed
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  availableOAuthProviders: string[];
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string; user_id?: string }>;
  signUp: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signInWithOAuth: (provider: string) => Promise<{ success: boolean; authUrl?: string; error?: string }>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  checkOAuthProviders: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [availableOAuthProviders, setAvailableOAuthProviders] = useState<string[]>([]);

  const refreshUser = async () => {
    console.log('AuthContext: refreshUser called');
    try {
      console.log('AuthContext: Calling stackAuthClient.getCurrentUser()');
      const userData = await stackAuthClient.getCurrentUser();
      console.log('AuthContext: getCurrentUser returned:', userData);
      if (userData) {
        console.log('AuthContext: Setting user data and authenticated state');
        setUser(userData);
        setIsAuthenticated(true);
      } else {
        console.log('AuthContext: No user data returned, clearing state');
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('AuthContext: Error refreshing user:', error);
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    console.log('AuthContext: signIn called with email:', email);
    setIsLoading(true);
    try {
      console.log('AuthContext: Calling stackAuthClient.signInWithPassword');
      const result = await stackAuthClient.signInWithPassword(email, password);
      console.log('AuthContext: stackAuthClient.signInWithPassword response:', result);
      if (result.success && result.user_id) {
        console.log('AuthContext: Sign in successful, setting user from response');
        // Fetch complete user data from API after successful sign-in
        console.log('AuthContext: Sign in successful, fetching complete user data');
        const completeUserData = await stackAuthClient.getCurrentUser();
        
        if (completeUserData) {
          console.log('AuthContext: Setting complete user data:', completeUserData);
          setUser(completeUserData);
        } else {
          // Fallback to basic user data if API call fails
          const userData = {
            id: result.user_id,
            email: email,
            displayName: email.split('@')[0],
            profile_image_url: undefined
          };
          console.log('AuthContext: Setting fallback user data:', userData);
          setUser(userData);
        }
        setIsAuthenticated(true);
      } else {
        console.log('AuthContext: Sign in failed:', result.error);
      }
      return result;
    } catch (error) {
      console.error('AuthContext: Sign in error caught:', error);
      return { success: false, error: 'Sign in failed' };
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (email: string, password: string) => {
    console.log('AuthContext: signUp called with email:', email);
    setIsLoading(true);
    try {
      console.log('AuthContext: Calling stackAuthClient.signUpWithPassword');
      const result = await stackAuthClient.signUpWithPassword(email, password);
      console.log('AuthContext: stackAuthClient.signUpWithPassword response:', result);
      if (result.success) {
        console.log('AuthContext: Sign up successful, refreshing user');
        await refreshUser();
      } else {
        console.log('AuthContext: Sign up failed:', result.error);
      }
      return result;
    } catch (error) {
      console.error('AuthContext: Sign up error caught:', error);
      return { success: false, error: 'Sign up failed' };
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    try {
      await stackAuthClient.signOut();
      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkOAuthProviders = async () => {
    try {
      const result = await stackAuthClient.getAvailableOAuthProviders();
      if (result.success && result.providers) {
        setAvailableOAuthProviders(result.providers);
      }
    } catch (error) {
      console.error('Error checking OAuth providers:', error);
    }
  };

  const signInWithOAuth = async (provider: string) => {
    try {
      return await stackAuthClient.signInWithOAuth(provider);
    } catch (error) {
      console.error('Error with OAuth sign-in:', error);
      return { success: false, error: 'OAuth sign-in failed' };
    }
  };

  useEffect(() => {
    console.log('AuthContext: useEffect triggered, checking for stored tokens');
    // Check if user has stored tokens on app load
    const checkStoredAuth = async () => {
      try {
        const accessToken = await StackTokenStorage.getAccessToken();
        if (accessToken) {
          console.log('AuthContext: Found stored access token, attempting to get user');
          const userData = await stackAuthClient.getCurrentUser();
          if (userData) {
            console.log('AuthContext: Retrieved user from stored token:', userData);
            setUser(userData);
            setIsAuthenticated(true);
          } else {
            console.log('AuthContext: Could not retrieve user, clearing tokens');
            await StackTokenStorage.clearTokens();
          }
        }
      } catch (error) {
        console.log('AuthContext: Error checking stored auth:', error);
        await StackTokenStorage.clearTokens();
      } finally {
        setIsLoading(false);
      }
    };
    
    checkStoredAuth();
    checkOAuthProviders();
  }, []);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated,
    availableOAuthProviders,
    signIn,
    signUp,
    signInWithOAuth,
    signOut,
    refreshUser,
    checkOAuthProviders,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};