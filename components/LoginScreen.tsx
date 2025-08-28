import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';

type AuthMode = 'signin' | 'signup';

const { width, height } = Dimensions.get('window');

export const LoginScreen: React.FC = () => {
  console.log('LoginScreen component loaded');
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { signIn, signUp, isLoading } = useAuth();
  
  console.log('LoginScreen state:', { mode, email: email ? 'has email' : 'no email', isSubmitting });

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password: string) => {
    return password.length >= 6;
  };

  const handleSubmit = async () => {
    console.log('=== Sign-in button pressed ===');
    console.log('Current state:', { mode, email, isSubmitting });
    
    if (isSubmitting) {
      console.log('Already submitting, returning early');
      return;
    }
    
    if (!email.trim() || !password.trim()) {
      console.log('Validation failed: empty fields');
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (!validateEmail(email)) {
      console.log('Validation failed: invalid email');
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    if (!validatePassword(password)) {
      console.log('Validation failed: password too short');
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return;
    }

    if (mode === 'signup' && password !== confirmPassword) {
      console.log('Validation failed: passwords do not match');
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setIsSubmitting(true);
    console.log('Submitting state set to true');

    try {
      if (mode === 'signin') {
        console.log('Attempting sign in with email:', email);
        const result = await signIn(email, password);
        console.log('Sign in result:', result);
        
        if (!result.success) {
          console.log('Sign in failed:', result.error);
          Alert.alert('Error', result.error || 'Sign in failed');
        } else {
          console.log('Sign in successful');
        }
      } else {
        console.log('Attempting sign up with email:', email);
        const result = await signUp(email, password);
        console.log('Sign up result:', result);
        
        if (!result.success) {
          console.log('Sign up failed:', result.error);
          Alert.alert('Error', result.error || 'Sign up failed');
        } else {
          console.log('Sign up successful');
        }
      }
      // Success is handled by the AuthContext which will update the app state
    } catch (error) {
      console.error('Authentication error:', error);
      console.error('Error message:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
      console.log('Submitting state set to false');
      console.log('=== Authentication process completed ===');
    }
  };

  const toggleMode = () => {
    setMode(mode === 'signin' ? 'signup' : 'signin');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
  };

  const isFormValid = () => {
    const basicValid = email.trim() && password.trim() && validateEmail(email) && validatePassword(password);
    if (mode === 'signup') {
      return basicValid && confirmPassword.trim() && password === confirmPassword;
    }
    return basicValid;
  };

  if (isLoading) {
    return (
      <View style={styles.fullScreenContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#85432d" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.fullScreenContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Logo Section */}
          <View style={styles.logoContainer}>
            <Image 
              source={require('../logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <Text style={styles.appName}>BootsERP</Text>
            <Text style={styles.tagline}>Your Agency Partner</Text>
          </View>

          {/* Form Section */}
          <View style={styles.formContainer}>
            <Text style={styles.title}>
              {mode === 'signin' ? 'Welcome Back' : 'Create Account'}
            </Text>
            <Text style={styles.subtitle}>
              {mode === 'signin' 
                ? 'Sign in to continue' 
                : 'Join us today'
              }
            </Text>

            <View style={styles.inputContainer}>
               <TextInput
                 style={styles.input}
                 value={email}
                 onChangeText={setEmail}
                 placeholder="Email address"
                 placeholderTextColor="#999999"
                 keyboardType="email-address"
                 autoCapitalize="none"
                 autoCorrect={false}
                 editable={!isSubmitting}
               />
             </View>

             <View style={styles.inputContainer}>
               <TextInput
                 style={styles.input}
                 value={password}
                 onChangeText={setPassword}
                 placeholder="Password"
                 placeholderTextColor="#999999"
                 secureTextEntry
                 autoCapitalize="none"
                 autoCorrect={false}
                 editable={!isSubmitting}
               />
             </View>

             {mode === 'signup' && (
               <View style={styles.inputContainer}>
                 <TextInput
                   style={styles.input}
                   value={confirmPassword}
                   onChangeText={setConfirmPassword}
                   placeholder="Confirm password"
                   placeholderTextColor="#999999"
                   secureTextEntry
                   autoCapitalize="none"
                   autoCorrect={false}
                   editable={!isSubmitting}
                 />
               </View>
             )}

            <TouchableOpacity
              style={[
                styles.submitButton,
                (!isFormValid() || isSubmitting) && styles.submitButtonDisabled
              ]}
              onPress={handleSubmit}
              disabled={!isFormValid() || isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text style={styles.submitButtonText}>
                  {mode === 'signin' ? 'Sign In' : 'Create Account'}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Bottom Sign Up Section */}
          <View style={styles.bottomContainer}>
            <View style={styles.divider} />
            <TouchableOpacity 
              style={styles.switchButton} 
              onPress={toggleMode} 
              disabled={isSubmitting}
            >
              <Text style={styles.switchButtonText}>
                {mode === 'signin' 
                  ? "Don't have an account? Sign Up" 
                  : "Already have an account? Sign In"
                }
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#333333',
    fontWeight: '500',
  },
  scrollContainer: {
    flexGrow: 1,
    minHeight: height,
    paddingHorizontal: 24,
  },
  logoContainer: {
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 80 : 60,
    paddingBottom: 40,
  },
  logoImage: {
    width: 120,
    height: 120,
    marginBottom: 16,
  },
  appName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 4,
  },
  tagline: {
    fontSize: 16,
    color: '#666666',
    fontWeight: '500',
  },
  formContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#333333',
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 40,
    color: '#666666',
    fontWeight: '500',
  },
  inputContainer: {
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 12,
    padding: 18,
    fontSize: 16,
    color: '#333333',
    fontWeight: '500',
  },
  submitButton: {
    backgroundColor: '#85432d',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#85432d',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    backgroundColor: 'rgba(133, 67, 45, 0.5)',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  bottomContainer: {
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    alignItems: 'center',
  },
  divider: {
    width: width * 0.3,
    height: 1,
    backgroundColor: '#e9ecef',
    marginBottom: 24,
  },
  switchButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  switchButtonText: {
    fontSize: 16,
    color: '#85432d',
    fontWeight: '600',
    textAlign: 'center',
  },
});