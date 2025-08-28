import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

import { useAuth } from '../contexts/AuthContext';
import { stackAuthClient } from '../lib/stack-auth';
import { TeamProfile } from './TeamProfile';

const { width } = Dimensions.get('window');

export const UserProfile: React.FC = () => {
  const { user, signOut, isLoading } = useAuth();
  const [teams, setTeams] = useState<any[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [teamsError, setTeamsError] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  const fetchTeams = async () => {
    try {
      setTeamsLoading(true);
      const result = await stackAuthClient.getTeams();
      if (result.success) {
        setTeams(result.teams || []);
        setTeamsError(null);
      } else {
        setTeamsError(result.error || 'Failed to load teams');
      }
    } catch (error) {
      setTeamsError('Error loading teams');
    } finally {
      setTeamsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchTeams();
    }
  }, [user]);

  const handleBackFromTeam = (shouldRefresh?: boolean) => {
    setSelectedTeamId(null);
    if (shouldRefresh) {
      fetchTeams();
    }
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: signOut,
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  // Show TeamProfile if a team is selected
  if (selectedTeamId) {
    return (
      <TeamProfile 
        teamId={selectedTeamId} 
        onBack={handleBackFromTeam} 
      />
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#84532d"
        translucent={true}
      />
      <ScrollView style={styles.fullscreenContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
        <View style={styles.avatarContainer}>
          {user?.profile_image_url ? (
            <Image 
              source={{ uri: user.profile_image_url }}
              style={styles.profileImage}
              onError={() => console.log('Profile image failed to load')}
            />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.displayName?.charAt(0)?.toUpperCase() || 
                 user?.email?.charAt(0)?.toUpperCase() || '?'}
              </Text>
            </View>
          )}
        </View>
        
        <Text style={styles.displayName}>
          {user?.displayName || user?.email?.split('@')[0]}
        </Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Account Information</Text>
          
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>User ID</Text>
              <Text style={styles.infoValue}>{user?.id}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Email Address</Text>
              <Text style={styles.infoValue}>{user?.email}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Display Name</Text>
              <Text style={styles.infoValue}>{user?.displayName || 'Not set'}</Text>
            </View>
          </View>

          {user?.profile_image_url && (
            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Profile Picture</Text>
                <Text style={styles.infoValue} numberOfLines={1}>
                  {user.profile_image_url.split('/').pop()}
                </Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>My Teams</Text>
          
          {teamsLoading ? (
            <View style={styles.teamsLoadingContainer}>
              <ActivityIndicator size="small" color="#84532d" />
              <Text style={styles.loadingText}>Loading teams...</Text>
            </View>
          ) : teamsError ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{teamsError}</Text>
            </View>
          ) : teams.length > 0 ? (
            teams.map((team, index) => (
              <TouchableOpacity 
                key={team.id || index} 
                style={styles.teamItem}
                onPress={() => setSelectedTeamId(team.id)}
              >
                <View style={styles.teamImageContainer}>
                  {team.profile_image_url ? (
                    <Image
                      source={{ uri: team.profile_image_url }}
                      style={styles.teamImage}
                    />
                  ) : (
                    <View style={styles.teamImagePlaceholder}>
                      <Text style={styles.teamImagePlaceholderText}>
                        {team.display_name?.charAt(0)?.toUpperCase() || 'T'}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.teamInfo}>
                  <Text style={styles.teamName}>{team.display_name}</Text>
                  <Text style={styles.teamDescription}>
                    {team.client_metadata?.description || 'No description available'}
                  </Text>
                </View>
                <View style={[styles.teamBadge, styles.teamBadgeInactive]}>
                  <Text style={[styles.teamBadgeText, styles.teamBadgeTextInactive]}>Member</Text>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>You are not a member of any teams yet.</Text>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Account Actions</Text>
          
          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <Text style={styles.signOutButtonText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
       </View>
     </ScrollView>
    </View>
    );
};

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: '#84532d',
    paddingTop: Platform.OS === 'ios' ? 80 : (StatusBar.currentHeight || 24) + 60,
  },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: '#84532d',
    paddingTop: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  header: {
    height: 240,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    backgroundColor: '#84532d',
    paddingTop: 20,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: 'white',
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'white',
  },
  avatarText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: 'white',
  },
  displayName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  email: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 16,
  },
  content: {
    padding: 20,
    marginTop: 20,
    backgroundColor: '#f8fafc',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 16,
  },
  infoRow: {
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'column',
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    color: '#1e293b',
    fontWeight: '500',
  },
  actionButton: {
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#475569',
  },
  signOutButton: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    backgroundColor: '#dc2626',
  },
  signOutButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  teamItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  teamImageContainer: {
    marginRight: 12,
  },
  teamImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  teamImagePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#84532d',
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamImagePlaceholderText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  teamInfo: {
    flex: 1,
  },
  teamName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 2,
  },
  teamDescription: {
    fontSize: 14,
    color: '#64748b',
  },
  teamBadge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  teamBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
  teamBadgeInactive: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  teamBadgeTextInactive: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  teamsLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#64748b',
  },
  errorContainer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#dc2626',
    textAlign: 'center',
  },
  emptyContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default UserProfile;