'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from './firebase';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSetupComplete, setIsSetupComplete] = useState(null);

  // Check if initial setup has been completed
  const checkSetupStatus = async () => {
    try {
      const settingsDoc = await getDoc(doc(db, 'settings', 'app'));
      if (settingsDoc.exists()) {
        setIsSetupComplete(settingsDoc.data().setupComplete === true);
        return settingsDoc.data().setupComplete === true;
      }
      setIsSetupComplete(false);
      return false;
    } catch (error) {
      console.error('Error checking setup status:', error);
      setIsSetupComplete(false);
      return false;
    }
  };

  // Fetch user profile from Firestore
  const fetchUserProfile = async (uid) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        const profile = { id: uid, ...userDoc.data() };
        setUserProfile(profile);
        return profile;
      }
      return null;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        await fetchUserProfile(firebaseUser.uid);
      } else {
        setUser(null);
        setUserProfile(null);
      }
      await checkSetupStatus();
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Sign up new user
  const signUp = async (email, password, userData) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const { user: newUser } = userCredential;
    
    // Update display name
    await updateProfile(newUser, { displayName: userData.name });
    
    // Create user document in Firestore
    await setDoc(doc(db, 'users', newUser.uid), {
      email: newUser.email,
      name: userData.name,
      firstName: userData.name.split(' ')[0],
      role: userData.role || 'freelancer',
      phone: userData.phone || '',
      company: userData.company || '',
      designation: userData.designation || '',
      avatar: userData.avatar || '👤',
      isCore: userData.isCore || false,
      isFreelancer: userData.isFreelancer || false,
      isClient: userData.isClient || false,
      createdAt: new Date().toISOString(),
      createdBy: userData.createdBy || newUser.uid,
    });
    
    await fetchUserProfile(newUser.uid);
    return userCredential;
  };

  // Sign in existing user
  const signIn = async (email, password) => {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    await fetchUserProfile(userCredential.user.uid);
    return userCredential;
  };

  // Sign out
  const signOut = async () => {
    await firebaseSignOut(auth);
    setUser(null);
    setUserProfile(null);
  };

  // Complete initial setup
  const completeSetup = async (adminData) => {
    // Create admin user
    const userCredential = await createUserWithEmailAndPassword(auth, adminData.email, adminData.password);
    const { user: adminUser } = userCredential;
    
    await updateProfile(adminUser, { displayName: adminData.name });
    
    // Create admin user document
    await setDoc(doc(db, 'users', adminUser.uid), {
      email: adminData.email,
      name: adminData.name,
      firstName: adminData.name.split(' ')[0],
      role: 'producer',
      phone: adminData.phone || '',
      company: adminData.company || 'Anandi Productions',
      avatar: '👑',
      isCore: true,
      isFreelancer: false,
      isClient: false,
      createdAt: new Date().toISOString(),
      createdBy: 'setup',
    });
    
    // Mark setup as complete
    await setDoc(doc(db, 'settings', 'app'), {
      setupComplete: true,
      setupDate: new Date().toISOString(),
      adminId: adminUser.uid,
      companyName: adminData.company || 'Anandi Productions',
    });
    
    setIsSetupComplete(true);
    await fetchUserProfile(adminUser.uid);
    return userCredential;
  };

  const value = {
    user,
    userProfile,
    loading,
    isSetupComplete,
    signUp,
    signIn,
    signOut,
    completeSetup,
    checkSetupStatus,
    fetchUserProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
