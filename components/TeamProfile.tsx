import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { stackAuthClient } from '../lib/stack-auth';

// Environment configuration
const TEAM_INVITATION_BASE_URL = process.env.EXPO_PUBLIC_TEAM_INVITATION_BASE_URL;

interface TeamProfileProps {
  teamId: string;
  onBack: (shouldRefresh?: boolean) => void;
}

interface TeamMember {
  user_id: string;
  display_name: string;
  profile_image_url?: string;
  email?: string;
  role?: string;
  bio?: string;
}

interface TeamInvitation {
  id: string;
  team_id: string;
  recipient_email: string;
  expires_at_millis: number;
}

interface Team {
  id: string;
  display_name: string;
  profile_image_url?: string;
  client_metadata?: any;
}

// Utility function to compress and crop image to square format under 100KB
const processImageForUpload = async (imageUri: string): Promise<string> => {
  try {
    // Get image info to determine dimensions
    const imageInfo = await ImageManipulator.manipulateAsync(
      imageUri,
      [],
      { format: ImageManipulator.SaveFormat.JPEG }
    );

    // Calculate crop dimensions for square
    const { width, height } = imageInfo;
    const size = Math.min(width, height);
    const cropX = (width - size) / 2;
    const cropY = (height - size) / 2;

    // Start with high quality and reduce if needed
    let quality = 0.8;
    let processedImage;

    do {
      processedImage = await ImageManipulator.manipulateAsync(
        imageUri,
        [
          {
            crop: {
              originX: cropX,
              originY: cropY,
              width: size,
              height: size,
            },
          },
          {
            resize: {
              width: 300,
              height: 300,
            },
          },
        ],
        {
          compress: quality,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        }
      );

      // Check if base64 size is under 100KB (base64 is ~33% larger than binary)
      const base64Size = processedImage.base64 ? processedImage.base64.length * 0.75 : 0;
      
      if (base64Size <= 100000 || quality <= 0.1) {
        break;
      }
      
      quality -= 0.1;
    } while (quality > 0.1);

    if (!processedImage.base64) {
      throw new Error('Failed to generate base64 image');
    }

    return `data:image/jpeg;base64,${processedImage.base64}`;
  } catch (error) {
    console.error('Error processing image:', error);
    throw new Error('Failed to process image. Please try a different image.');
  }
};

export const TeamProfile: React.FC<TeamProfileProps> = ({ teamId, onBack }) => {
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTeamName, setEditTeamName] = useState('');
  const [editTeamImage, setEditTeamImage] = useState('');
  const [editMemberModalVisible, setEditMemberModalVisible] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [editMemberDisplayName, setEditMemberDisplayName] = useState('');
  const [editMemberProfileImage, setEditMemberProfileImage] = useState('');
  const [imageProcessing, setImageProcessing] = useState(false);

  useEffect(() => {
    loadTeamData();
  }, [teamId]);

  const loadTeamData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Load team details
      const teamResult = await stackAuthClient.getTeam(teamId);
      if (teamResult.success && teamResult.team) {
        setTeam(teamResult.team);
        setEditTeamName(teamResult.team.display_name);
        setEditTeamImage(teamResult.team.profile_image_url || '');
      } else {
        setError(teamResult.error || 'Failed to load team');
        return;
      }

      // Check if current user has admin permissions to view emails
      const permissionsResult = await stackAuthClient.getTeamPermissions(teamId, 'me');
      let isAdmin = false;
      
      if (permissionsResult.success) {
        // Check if user has admin permissions (can manage team, remove members, etc.)
        const adminPermissions = ['$update_team', '$delete_team', '$remove_members', '$manage_api_keys', 'team_admin'];
        isAdmin = permissionsResult.permissions?.some(permission => 
          adminPermissions.includes(permission.id)
        ) || false;
        console.log('TeamProfile: User admin status:', isAdmin);
      }

      // Load team members
      const membersResult = await stackAuthClient.getTeamMembers(teamId);
      if (membersResult.success) {
        const teamMembers = membersResult.members || [];
        
        // Only fetch email addresses if user is admin
        if (isAdmin) {
          console.log('TeamProfile: User is admin, attempting to fetch emails');
          // For admin users, fetch actual email addresses using server API
          const profilesResult = await stackAuthClient.getTeamMemberProfiles(teamId);
          if (profilesResult.success && profilesResult.profiles) {
            const membersWithEmails = teamMembers.map(member => {
              const profile = profilesResult.profiles?.find(p => p.user_id === member.user_id);
              return {
                ...member,
                email: profile?.user?.primary_email || 'Email not available'
              };
            });
            setMembers(membersWithEmails);
          } else {
            // Fallback to placeholder if API call fails
            const membersWithEmails = teamMembers.map(member => ({
              ...member,
              email: 'Email visible to admins only'
            }));
            setMembers(membersWithEmails);
          }
        } else {
          console.log('TeamProfile: User is not admin, hiding emails');
          // For non-admin users, don't show emails
          setMembers(teamMembers);
        }
      }

      // Load team invitations
      const invitationsResult = await stackAuthClient.getTeamInvitations(teamId);
      if (invitationsResult.success) {
        setInvitations(invitationsResult.invitations || []);
      }
    } catch (err) {
      setError('Failed to load team data');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (userId: string, memberName: string) => {
    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove ${memberName} from the team?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const result = await stackAuthClient.removeTeamMember(teamId, userId);
            if (result.success) {
              setMembers(members.filter(m => m.user_id !== userId));
              Alert.alert('Success', 'Member removed successfully');
            } else {
              Alert.alert('Error', result.error || 'Failed to remove member');
            }
          },
        },
      ]
    );
  };

  const handleInviteUser = async () => {
    if (!inviteEmail.trim()) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }

    const result = await stackAuthClient.sendTeamInvitation(
      teamId,
      inviteEmail.trim(),
      TEAM_INVITATION_BASE_URL
    );

    if (result.success) {
      Alert.alert('Success', 'Invitation sent successfully');
      setInviteEmail('');
      setShowInviteModal(false);
      loadTeamData(); // Refresh invitations
    } else {
      Alert.alert('Error', result.error || 'Failed to send invitation');
    }
  };

  const handleUpdateTeam = async () => {
    if (!editTeamName.trim()) {
      Alert.alert('Error', 'Team name cannot be empty');
      return;
    }

    const updates: any = {
      display_name: editTeamName.trim(),
    };

    if (editTeamImage.trim()) {
      updates.profile_image_url = editTeamImage.trim();
    }

    const result = await stackAuthClient.updateTeam(teamId, updates);
    if (result.success) {
      setTeam(result.team);
      setShowEditModal(false);
      Alert.alert('Success', 'Team updated successfully');
    } else {
      Alert.alert('Error', result.error || 'Failed to update team');
    }
  };

  const handleDeleteInvitation = async (invitationId: string) => {
    Alert.alert(
      'Delete Invitation',
      'Are you sure you want to delete this invitation?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await stackAuthClient.deleteTeamInvitation(invitationId, teamId);
            if (result.success) {
              setInvitations(invitations.filter(i => i.id !== invitationId));
              Alert.alert('Success', 'Invitation deleted successfully');
            } else {
              Alert.alert('Error', result.error || 'Failed to delete invitation');
            }
          },
        },
      ]
    );
  };

  const handleResendInvitation = async (email: string) => {
    const result = await stackAuthClient.sendTeamInvitation(
      teamId,
      email,
      TEAM_INVITATION_BASE_URL
    );

    if (result.success) {
      Alert.alert('Success', 'Invitation resent successfully');
      loadTeamData(); // Refresh invitations
    } else {
      Alert.alert('Error', result.error || 'Failed to resend invitation');
    }
  };

  const handleDeleteTeam = async () => {
    Alert.alert(
      'Delete Team',
      'Are you sure you want to delete this team? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await stackAuthClient.deleteTeam(teamId);
            if (result.success) {
              Alert.alert('Success', 'Team deleted successfully');
              onBack(true);
            } else {
              Alert.alert('Error', result.error || 'Failed to delete team');
            }
          },
        },
      ]
    );
  };

  const handleEditMember = (member: TeamMember) => {
    setSelectedMember(member);
    setEditMemberDisplayName(member.display_name || '');
    setEditMemberProfileImage(member.profile_image_url || '');
    setEditMemberModalVisible(true);
  };

  const pickImage = async () => {
    try {
      // Request permission
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('Permission Required', 'Permission to access camera roll is required!');
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        setImageProcessing(true);
        try {
          const processedImage = await processImageForUpload(result.assets[0].uri);
          setEditMemberProfileImage(processedImage);
        } catch (error) {
          Alert.alert('Error', error instanceof Error ? error.message : 'Failed to process image');
        } finally {
          setImageProcessing(false);
        }
      }
    } catch (error) {
      setImageProcessing(false);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleUpdateMemberProfile = async () => {
    if (!selectedMember) return;
    
    if (!editMemberDisplayName.trim()) {
      Alert.alert('Error', 'Display name cannot be empty');
      return;
    }
    
    try {
      const updates: { display_name: string; profile_image_url?: string } = {
        display_name: editMemberDisplayName.trim(),
      };
      
      if (editMemberProfileImage.trim()) {
        updates.profile_image_url = editMemberProfileImage.trim();
      }
      
      const result = await stackAuthClient.updateTeamMemberProfile(teamId, updates);
      
      if (!result.success) {
        Alert.alert('Error', result.error || 'Failed to update member profile');
        return;
      }
       
       setEditMemberModalVisible(false);
       setSelectedMember(null);
       setEditMemberDisplayName('');
       setEditMemberProfileImage('');
       Alert.alert('Success', 'Member profile updated successfully');
      // Refresh members list with emails
      const membersData = await stackAuthClient.getTeamMembers(teamId);
      if (membersData.success) {
        // Check admin permissions again
        const permissionsResult = await stackAuthClient.getTeamPermissions(teamId, 'me');
        let isAdmin = false;
        
        if (permissionsResult.success) {
          const adminPermissions = ['$update_team', '$delete_team', '$remove_members', '$manage_api_keys', 'team_admin'];
           isAdmin = permissionsResult.permissions?.some(permission => 
             adminPermissions.includes(permission.id)
           ) || false;
        }
        
        // Only show emails if user is admin
        if (isAdmin) {
          // For admin users, fetch actual email addresses using server API
          const profilesResult = await stackAuthClient.getTeamMemberProfiles(teamId);
          if (profilesResult.success && profilesResult.profiles) {
            const membersWithEmails = (membersData.members || []).map(member => {
              const profile = profilesResult.profiles?.find(p => p.user_id === member.user_id);
              return {
                ...member,
                email: profile?.user?.primary_email || 'Email not available'
              };
            });
            setMembers(membersWithEmails);
          } else {
            // Fallback to placeholder if API call fails
            const membersWithEmails = (membersData.members || []).map(member => ({
              ...member,
              email: 'Email visible to admins only'
            }));
            setMembers(membersWithEmails);
          }
        } else {
          // For non-admin users, don't show emails
          setMembers(membersData.members || []);
        }
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to update member profile');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => onBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Team Profile</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading team...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => onBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Team Profile</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={loadTeamData} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => onBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Team Profile</Text>
        <TouchableOpacity onPress={() => setShowEditModal(true)} style={styles.editButton}>
          <Ionicons name="create-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Team Header */}
        <View style={styles.teamHeader}>
          <View style={styles.teamImageContainer}>
            {team?.profile_image_url ? (
              <Image source={{ uri: team.profile_image_url }} style={styles.teamImage} />
            ) : (
              <View style={styles.teamImagePlaceholder}>
                <Text style={styles.teamImagePlaceholderText}>
                  {team?.display_name?.charAt(0).toUpperCase() || 'T'}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.teamName}>{team?.display_name}</Text>
        </View>

        {/* Team Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Team Actions</Text>
          <TouchableOpacity onPress={() => setShowInviteModal(true)} style={styles.actionButton}>
            <Ionicons name="person-add-outline" size={20} color="#007AFF" />
            <Text style={styles.actionButtonText}>Invite Member</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDeleteTeam} style={[styles.actionButton, styles.dangerButton]}>
            <Ionicons name="trash-outline" size={20} color="#FF3B30" />
            <Text style={[styles.actionButtonText, styles.dangerText]}>Delete Team</Text>
          </TouchableOpacity>
        </View>

        {/* Team Members */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Members ({members.length})</Text>
          {members.map((member) => (
            <View key={member.user_id} style={styles.memberItem}>
              <View style={styles.memberInfo}>
                <View style={styles.memberImageContainer}>
                  {member.profile_image_url ? (
                    <Image source={{ uri: member.profile_image_url }} style={styles.memberImage} />
                  ) : (
                    <View style={styles.memberImagePlaceholder}>
                      <Text style={styles.memberImagePlaceholderText}>
                        {member.display_name?.charAt(0).toUpperCase() || 'U'}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.memberDetails}>
                  <Text style={styles.memberName}>{member.display_name}</Text>
                  {member.email && <Text style={styles.memberEmail}>{member.email}</Text>}
                  {member.role && <Text style={styles.memberRole}>{member.role}</Text>}
                </View>
              </View>
              <View style={{ flexDirection: 'row' }}>
                <TouchableOpacity
                  onPress={() => handleEditMember(member)}
                  style={styles.editButton}
                >
                  <Ionicons name="create-outline" size={20} color="#007AFF" />
                </TouchableOpacity>
                <TouchableOpacity
                   onPress={() => handleRemoveMember(member.user_id, member.display_name)}
                   style={styles.removeButton}
                 >
                  <Ionicons name="person-remove-outline" size={20} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        {/* Team Invitations */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pending Invitations ({invitations.length})</Text>
          {invitations.map((invitation) => (
            <View key={invitation.id} style={styles.invitationItem}>
              <View style={styles.invitationInfo}>
                <Text style={styles.invitationEmail}>{invitation.recipient_email}</Text>
                <Text style={styles.invitationDate}>
                  Expires {new Date(invitation.expires_at_millis).toLocaleDateString()}
                </Text>
              </View>
              <View style={styles.invitationActions}>
                <TouchableOpacity
                  onPress={() => handleResendInvitation(invitation.recipient_email)}
                  style={styles.resendInvitationButton}
                >
                  <Ionicons name="refresh-outline" size={20} color="#007AFF" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDeleteInvitation(invitation.id)}
                  style={styles.deleteInvitationButton}
                >
                  <Ionicons name="close-outline" size={20} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
          {invitations.length === 0 && (
            <Text style={styles.emptyText}>No pending invitations</Text>
          )}
        </View>
      </ScrollView>

      {/* Invite Modal */}
      <Modal visible={showInviteModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Invite Team Member</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter email address"
              value={inviteEmail}
              onChangeText={setInviteEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                onPress={() => {
                  setShowInviteModal(false);
                  setInviteEmail('');
                }}
                style={[styles.modalButton, styles.cancelButton]}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleInviteUser} style={[styles.modalButton, styles.confirmButton]}>
                <Text style={styles.confirmButtonText}>Send Invite</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Team Modal */}
      <Modal visible={showEditModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Team</Text>
            <TextInput
              style={styles.input}
              placeholder="Team name"
              value={editTeamName}
              onChangeText={setEditTeamName}
            />
            <TextInput
              style={styles.input}
              placeholder="Profile image URL (optional)"
              value={editTeamImage}
              onChangeText={setEditTeamImage}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                onPress={() => {
                  setShowEditModal(false);
                  setEditTeamName(team?.display_name || '');
                  setEditTeamImage(team?.profile_image_url || '');
                }}
                style={[styles.modalButton, styles.cancelButton]}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleUpdateTeam} style={[styles.modalButton, styles.confirmButton]}>
                <Text style={styles.confirmButtonText}>Update</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Member Modal */}
      <Modal visible={editMemberModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Member Profile</Text>
            <TextInput
              style={styles.input}
              placeholder="Display name"
              value={editMemberDisplayName}
              onChangeText={setEditMemberDisplayName}
            />
            
            {/* Profile Image Section */}
            <View style={styles.imageSection}>
              <Text style={styles.imageSectionTitle}>Profile Image</Text>
              
              {/* Image Preview */}
              <View style={styles.imagePreviewContainer}>
                {editMemberProfileImage ? (
                  <Image source={{ uri: editMemberProfileImage }} style={styles.imagePreview} />
                ) : (
                  <View style={styles.imagePreviewPlaceholder}>
                    <Ionicons name="person" size={40} color="#666" />
                  </View>
                )}
              </View>
              
              {/* Image Picker Buttons */}
              <View style={styles.imageButtons}>
                <TouchableOpacity 
                  onPress={pickImage} 
                  style={[styles.imageButton, imageProcessing && styles.imageButtonDisabled]}
                  disabled={imageProcessing}
                >
                  <Ionicons name="camera" size={16} color={imageProcessing ? "#999" : "#007AFF"} />
                  <Text style={[styles.imageButtonText, imageProcessing && styles.imageButtonTextDisabled]}>
                    {imageProcessing ? 'Processing...' : 'Select Image'}
                  </Text>
                </TouchableOpacity>
                
                {editMemberProfileImage && (
                  <TouchableOpacity 
                    onPress={() => setEditMemberProfileImage('')} 
                    style={styles.imageButton}
                  >
                    <Ionicons name="trash" size={16} color="#FF3B30" />
                    <Text style={[styles.imageButtonText, { color: '#FF3B30' }]}>Remove</Text>
                  </TouchableOpacity>
                )}
              </View>
              
              <Text style={styles.imageHint}>Image will be cropped to square and compressed to under 100KB</Text>
            </View>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                onPress={() => {
                  setEditMemberModalVisible(false);
                  setSelectedMember(null);
                  setEditMemberDisplayName('');
                  setEditMemberProfileImage('');
                }}
                style={[styles.modalButton, styles.cancelButton]}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={handleUpdateMemberProfile} 
                style={[styles.modalButton, styles.confirmButton, imageProcessing && styles.confirmButtonDisabled]}
                disabled={imageProcessing}
              >
                <Text style={[styles.confirmButtonText, imageProcessing && styles.confirmButtonTextDisabled]}>
                  {imageProcessing ? 'Processing...' : 'Update'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 12 : (StatusBar.currentHeight || 24) + 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    marginRight: 16,
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },

  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  teamHeader: {
    backgroundColor: '#fff',
    alignItems: 'center',
    paddingVertical: 30,
    marginBottom: 20,
  },
  teamImageContainer: {
    marginBottom: 16,
  },
  teamImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  teamImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamImagePlaceholderText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '600',
  },
  teamName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  section: {
    backgroundColor: '#fff',
    marginBottom: 20,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  actionButtonText: {
    fontSize: 16,
    color: '#007AFF',
    marginLeft: 12,
  },
  dangerButton: {
    borderBottomWidth: 0,
  },
  dangerText: {
    color: '#FF3B30',
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  memberImageContainer: {
    marginRight: 12,
  },
  memberImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  memberImagePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberImagePlaceholderText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  memberDetails: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  memberEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  memberRole: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 2,
  },
  editButton: {
    padding: 8,
    marginRight: 8,
  },
  removeButton: {
    padding: 8,
  },
  invitationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  invitationInfo: {
    flex: 1,
  },
  invitationEmail: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  invitationDate: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  invitationActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resendInvitationButton: {
    padding: 8,
    marginRight: 8,
  },
  deleteInvitationButton: {
    padding: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingVertical: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
    marginRight: 8,
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: '#007AFF',
    marginLeft: 8,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButtonDisabled: {
    backgroundColor: '#ccc',
  },
  confirmButtonTextDisabled: {
    color: '#999',
  },
  imageSection: {
    marginBottom: 16,
  },
  imageSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  imagePreviewContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  imagePreview: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  imagePreviewPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed',
  },
  imageButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 8,
  },
  imageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#007AFF',
    backgroundColor: '#fff',
  },
  imageButtonDisabled: {
    borderColor: '#ccc',
    backgroundColor: '#f5f5f5',
  },
  imageButtonText: {
    fontSize: 14,
    color: '#007AFF',
    marginLeft: 4,
    fontWeight: '500',
  },
  imageButtonTextDisabled: {
    color: '#999',
  },
  imageHint: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});