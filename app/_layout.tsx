import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import { useEffect } from 'react';
import { useRouter, Slot } from 'expo-router';
import 'react-native-reanimated';

import { AuthProvider } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    // Handle incoming URLs (for OAuth callbacks)
    const handleUrl = (url: string) => {
      console.log('Received URL:', url);
      const parsed = Linking.parse(url);
      console.log('Parsed URL:', parsed);
      console.log('Parsed path:', parsed.path);
      console.log('Parsed queryParams:', parsed.queryParams);
      
      // Check if this is an OAuth callback URL
      if (url.includes('oauth-callback') || parsed.path === 'oauth-callback' || (parsed.queryParams && (parsed.queryParams.code || parsed.queryParams.error))) {
        console.log('OAuth callback detected');
        // Extract query parameters and navigate to oauth-callback route
        const queryString = parsed.queryParams ? 
          Object.entries(parsed.queryParams)
            .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
            .join('&') : '';
        
        const route = queryString ? `/oauth-callback?${queryString}` : '/oauth-callback';
        console.log('Navigating to:', route);
        router.push(route as any);
      } else {
        console.log('Not an oauth-callback, ignoring. URL:', url);
      }
    };

    // Listen for URL events
    const subscription = Linking.addEventListener('url', (event) => {
      console.log('URL event received:', event.url);
      handleUrl(event.url);
    });

    // Handle initial URL if app was opened via deep link
    Linking.getInitialURL().then((url) => {
      console.log('Initial URL check:', url);
      if (url) {
        console.log('Processing initial URL:', url);
        handleUrl(url);
      }
    });

    return () => {
      subscription?.remove();
    };
  }, [router]);

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }

  return (
    <AuthProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Slot />
        <StatusBar style="auto" />
      </ThemeProvider>
    </AuthProvider>
  );
}
