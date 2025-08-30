import { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { stackAuthClient } from '../lib/stack-auth';

export default function OAuthCallback() {
  console.log('OAuthCallback component rendered');
  const router = useRouter();
  const { code, state, error } = useLocalSearchParams<{
    code?: string;
    state?: string;
    error?: string;
  }>();
  const { refreshUser } = useAuth();
  
  console.log('OAuthCallback params:', { code, state, error });

  useEffect(() => {
    const handleCallback = async () => {
      console.log('OAuth callback received:', { code, state, error });
      
      if (error) {
        console.error('OAuth error:', error);
        // Handle OAuth error - redirect to login with error message
        router.replace('/');
        return;
      }

      if (code && state) {
        try {
          console.log('Processing OAuth callback with code and state');
          const result = await stackAuthClient.handleOAuthCallback(code, state);
          
          if (result.success) {
            console.log('OAuth callback successful, refreshing user');
            // Refresh user data and redirect to main app
            await refreshUser();
            router.replace('/');
          } else {
            console.error('OAuth callback failed:', result.error);
            // Handle callback error - redirect to login
            router.replace('/');
          }
        } catch (error) {
          console.error('Error processing OAuth callback:', error);
          router.replace('/');
        }
      } else {
        console.error('Missing code or state parameter');
        router.replace('/');
      }
    };

    handleCallback();
  }, [code, state, error, router, refreshUser]);

  return (
    <View style={{
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#f8f9fa'
    }}>
      <ActivityIndicator size="large" color="#007AFF" />
      <Text style={{
        marginTop: 16,
        fontSize: 16,
        color: '#666',
        textAlign: 'center'
      }}>
        Completing sign in...
      </Text>
    </View>
  );
}
