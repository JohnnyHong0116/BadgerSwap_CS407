// src/components/EditProfileScreen.tsx
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../features/auth/AuthProvider';
import { db, doc, getDoc, updateDoc, updateProfile } from '../lib/firebase';
import { COLORS } from '../theme/colors';

export default function EditProfileScreen() {
  const { user, loading } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [initialDisplayName, setInitialDisplayName] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [initialPhotoUrl, setInitialPhotoUrl] = useState('');
  const [pendingPhotoUrl, setPendingPhotoUrl] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [initialPhoneNumber, setInitialPhoneNumber] = useState('');
  const [bio, setBio] = useState('');
  const [initialBio, setInitialBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [photoModalVisible, setPhotoModalVisible] = useState(false);

  // Load the user's current profile info
  useEffect(() => {
    if (user) {
      const name = user.displayName ?? '';
      setDisplayName(name);
      setInitialDisplayName(name);

      const photo = user.photoURL ?? '';
      setPhotoUrl(photo);
      setInitialPhotoUrl(photo);
      setPendingPhotoUrl(photo);
      setPhoneNumber('');
      setInitialPhoneNumber('');
      setBio('');
      setInitialBio('');

      let isMounted = true;
      const loadProfile = async () => {
        try {
          const snap = await getDoc(doc(db, 'users', user.uid));
          if (snap.exists()) {
            const data = snap.data() as { photoURL?: string; bio?: string; phoneNumber?: string };
            if (isMounted) {
              if (data.photoURL) {
                setPhotoUrl(data.photoURL);
                setInitialPhotoUrl(data.photoURL);
                setPendingPhotoUrl(data.photoURL);
              }
              if (data.bio) {
                setBio(data.bio);
                setInitialBio(data.bio);
              }
              if (data.phoneNumber) {
                setPhoneNumber(data.phoneNumber);
                setInitialPhoneNumber(data.phoneNumber);
              }
            }
          }
        } catch (err) {
          console.error('Failed to load profile details:', err);
        }
      };

      void loadProfile();

      return () => {
        isMounted = false;
      };
    }
  }, [user]);

  // Handle saving updated profile info
  const handleSave = async () => {
    if (!user) {
      Alert.alert('Not signed in', 'Please sign in to edit your profile.');
      return;
    }

    const trimmed = displayName.trim();
    const trimmedPhoto = photoUrl.trim();
    const trimmedPhone = phoneNumber.trim();
    const trimmedBio = bio.trim();

    if (!trimmed) {
      Alert.alert('Name required', 'Please enter a display name.');
      return;
    }

    // If nothing changed, simply go back
    if (
      trimmed === initialDisplayName &&
      trimmedPhoto === initialPhotoUrl &&
      trimmedPhone === initialPhoneNumber &&
      trimmedBio === initialBio
    ) {
      router.back();
      return;
    }

    try {
      setSaving(true);

      // Update Firebase Auth display name and photo
      await updateProfile(user, { displayName: trimmed, photoURL: trimmedPhoto || null });

      // Update Firestore user document
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        displayName: trimmed,
        photoURL: trimmedPhoto,
        phoneNumber: trimmedPhone,
        bio: trimmedBio,
      });

      setInitialDisplayName(trimmed);
      setInitialPhotoUrl(trimmedPhoto);
      setPendingPhotoUrl(trimmedPhoto);
      setInitialPhoneNumber(trimmedPhone);
      setInitialBio(trimmedBio);

      Alert.alert('Profile updated', 'Your changes have been saved.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error', err?.message ?? 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  // Loading state while auth is initializing
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  // If user is not logged in
  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Please sign in to edit your profile.</Text>
      </View>
    );
  }

  const handleChangePhotoPress = () => {
    setPendingPhotoUrl(photoUrl.trim());
    setPhotoModalVisible(true);
  };

  const handleApplyPhoto = () => {
    setPhotoUrl(pendingPhotoUrl.trim());
    setPhotoModalVisible(false);
  };

  const handleCancelPhoto = () => {
    setPendingPhotoUrl(photoUrl.trim());
    setPhotoModalVisible(false);
  };

  const disabled =
    saving ||
    (displayName.trim() === initialDisplayName &&
      photoUrl.trim() === initialPhotoUrl &&
      phoneNumber.trim() === initialPhoneNumber &&
      bio.trim() === initialBio);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Edit profile</Text>
        <Text style={styles.subtitle}>
          Update how your name appears to other BadgerSwap users.
        </Text>

        {/* Profile photo */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Profile photo</Text>
          <View style={styles.photoColumn}>
            <View style={styles.avatarPreviewLarge}>
              {photoUrl.trim() ? (
                <Image source={{ uri: photoUrl.trim() }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarPlaceholder}>👤</Text>
              )}
            </View>
            <TouchableOpacity
              style={[styles.button, styles.secondaryButton, styles.changePhotoButton]}
              onPress={handleChangePhotoPress}
              disabled={saving}
            >
              <Text style={[styles.buttonText, styles.secondaryButtonText]}>Change photo</Text>
            </TouchableOpacity>
            <Text style={styles.helperText}>Use a square, public image URL.</Text>
            {photoUrl ? (
              <TouchableOpacity onPress={() => setPhotoUrl('')} style={styles.clearLink}>
                <Text style={styles.clearLinkText}>Remove photo</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Display name input */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Display name</Text>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your name"
            style={styles.input}
            autoCapitalize="words"
            autoCorrect={false}
          />
        </View>

        {/* Email is read-only */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Email</Text>
          <View style={[styles.input, styles.inputDisabled]}>
            <Text style={styles.inputDisabledText}>{user.email}</Text>
          </View>
        </View>

        {/* Phone number */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Phone number</Text>
          <TextInput
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            placeholder="(608) 555-1234"
            style={styles.input}
            keyboardType="phone-pad"
            autoCapitalize="none"
          />
          <Text style={styles.helperText}>Shared on your profile so buyers can contact you.</Text>
        </View>

        {/* Basic info */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Bio</Text>
          <TextInput
            value={bio}
            onChangeText={setBio}
            placeholder="Tell people about yourself, what you're selling, or what you're looking for."
            style={[styles.input, styles.multilineInput]}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
          <Text style={styles.helperText}>Keep it short and friendly.</Text>
        </View>

        {/* Action buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={() => router.back()}
            disabled={saving}
          >
            <Text style={[styles.buttonText, styles.secondaryButtonText]}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, disabled ? styles.buttonDisabled : styles.primaryButton]}
            onPress={handleSave}
            disabled={disabled}
          >
            {saving ? (
              <ActivityIndicator />
            ) : (
              <Text style={[styles.buttonText, disabled && styles.buttonTextDisabled]}>Save</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
      <Modal
        transparent
        animationType="fade"
        visible={photoModalVisible}
        onRequestClose={handleCancelPhoto}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Update photo</Text>
            <TextInput
              value={pendingPhotoUrl}
              onChangeText={setPendingPhotoUrl}
              placeholder="Link to a square image (https://...)"
              style={[styles.input, styles.modalInput]}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.helperText}>Paste a public image URL.</Text>
            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={[styles.button, styles.secondaryButton]}
                onPress={handleCancelPhoto}
              >
                <Text style={[styles.buttonText, styles.secondaryButtonText]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.primaryButton]}
                onPress={handleApplyPhoto}
              >
                <Text style={styles.buttonText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 32,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 24,
  },
  fieldGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  helperText: {
    marginTop: 6,
    color: '#6B7280',
    fontSize: 12,
    lineHeight: 16,
  },
  photoColumn: {
    alignItems: 'center',
    gap: 10,
  },
  avatarPreviewLarge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    fontSize: 28,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#111827',
    backgroundColor: COLORS.white,
  },
  multilineInput: {
    minHeight: 96,
  },
  inputDisabled: {
    backgroundColor: '#F3F4F6',
  },
  inputDisabledText: {
    color: '#6B7280',
  },
  clearLink: {
    marginTop: 6,
  },
  clearLinkText: {
    color: COLORS.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 32,
    gap: 12,
  },
  button: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  changePhotoButton: {
    paddingHorizontal: 18,
    minWidth: 160,
  },
  buttonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  buttonText: {
    fontWeight: '600',
    color: COLORS.white,
  },
  buttonTextDisabled: {
    color: '#9CA3AF',
  },
  secondaryButtonText: {
    color: '#111827',
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 14,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 20,
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  modalInput: {
    width: '100%',
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 10,
  },
});
