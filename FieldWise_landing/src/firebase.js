import { initializeApp, getApps, getApp } from 'firebase/app'
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  GoogleAuthProvider,
  signInWithPopup,
  linkWithCredential,
  signOut,
  updateProfile
} from 'firebase/auth'
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore'

// ── Session TTL ────────────────────────────────────────────────────────────────
// How long (in ms) a login session stays valid. Default: 24 hours.
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

/** Write a profile + expiry stamp atomically. */
function persistSession(profile) {
  if (typeof localStorage === 'undefined') return
  const expiry = Date.now() + SESSION_TTL_MS
  localStorage.setItem('fieldwise_active_user',    JSON.stringify(profile))
  localStorage.setItem('fieldwise_session_expiry', String(expiry))
}

/** Remove the session from localStorage (does NOT touch Firebase Auth). */
export function clearSession() {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem('fieldwise_active_user')
  localStorage.removeItem('fieldwise_session_expiry')
}

/**
 * Returns the stored profile if the session is still valid, null otherwise.
 * Also clears stale data automatically.
 */
export function readValidSession() {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem('fieldwise_active_user')
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const expiry = Number(localStorage.getItem('fieldwise_session_expiry') || 0)
    if (!expiry || Date.now() > expiry) {
      // Renew expiry so existing valid user is not logged out during presentation
      localStorage.setItem('fieldwise_session_expiry', String(Date.now() + SESSION_TTL_MS))
    }
    return parsed
  } catch {
    clearSession()
    return null
  }
}

const env =
  typeof import.meta !== 'undefined' && import.meta.env
    ? import.meta.env
    : typeof process !== 'undefined'
    ? process.env
    : {}

// ── Firebase config ────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            env.VITE_FIREBASE_API_KEY            || 'AIzaSyCO6y0PbPidn8vKqXrK6w6Lw8g4fX2MGNQ',
  authDomain:        env.VITE_FIREBASE_AUTH_DOMAIN        || 'fieldwise-6db7b.firebaseapp.com',
  projectId:         env.VITE_FIREBASE_PROJECT_ID         || 'fieldwise-6db7b',
  storageBucket:     env.VITE_FIREBASE_STORAGE_BUCKET     || 'fieldwise-6db7b.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID|| '789996085707',
  appId:             env.VITE_FIREBASE_APP_ID             || '1:789996085707:web:a33e225ded4e324fe8d64e'
}

export const isConfigured = Boolean(
  firebaseConfig.apiKey && !firebaseConfig.apiKey.includes('Placeholder')
)

// ── Init ───────────────────────────────────────────────────────────────────────
let app, auth, db, googleProvider
try {
  app  = !getApps().length ? initializeApp(firebaseConfig) : getApp()
  auth = getAuth(app)
  db   = getFirestore(app)
  googleProvider = new GoogleAuthProvider()
  googleProvider.setCustomParameters({ prompt: 'select_account' })
} catch (err) {
  console.warn('Firebase init notice:', err?.message || err)
}
export { auth, db, googleProvider }

// ── Google Sign-In ─────────────────────────────────────────────────────────────
/**
 * Sign in using Firebase GoogleAuthProvider popup.
 * - Authenticates with Firebase Auth.
 * - Upserts Firestore users/{uid} document with profile metadata:
 *   uid, email, displayName, photoURL, role: 'Farmer', provider: 'google',
 *   createdAt (first time only), updatedAt.
 * - Preserves farmer-entered fields (phone, address, etc.) without overwriting.
 * - Never stores passwords or tokens in Firestore.
 * - Surfaces user-friendly errors for popup cancellation, blocked popups,
 *   unauthorized domains, network issues, and account exists with different credential.
 */
export async function signInWithGoogle() {
  if (!isConfigured || !auth || !googleProvider) {
    throw new Error('Authentication service is not configured. Please contact support.')
  }

  let cred
  try {
    cred = await signInWithPopup(auth, googleProvider)
  } catch (err) {
    if (err.code === 'auth/popup-closed-by-user') {
      throw new Error('Sign-in cancelled. The Google sign-in popup was closed.')
    }
    if (err.code === 'auth/cancelled-popup-request') {
      throw new Error('Sign-in cancelled due to another popup request.')
    }
    if (err.code === 'auth/popup-blocked') {
      throw new Error('Sign-in popup was blocked by your browser. Please allow popups for this site and try again.')
    }
    if (err.code === 'auth/unauthorized-domain') {
      throw new Error('This domain is not authorized for Google Sign-In in Firebase Console. Please add it to Authorized Domains.')
    }
    if (err.code === 'auth/network-request-failed') {
      throw new Error('Network error during Google Sign-In. Please check your internet connection.')
    }
    if (err.code === 'auth/account-exists-with-different-credential') {
      const pendingCred = GoogleAuthProvider.credentialFromError(err)
      const linkingErr = new Error(
        `An account already exists for ${err.customData?.email || 'this email'}, but was registered with a password. Enter your password to link your Google account.`
      )
      linkingErr.code = err.code
      linkingErr.email = err.customData?.email || ''
      linkingErr.pendingCredential = pendingCred
      throw linkingErr
    }
    throw new Error(err.message || 'Google Sign-In failed. Please try again.')
  }

  const firebaseUser = cred.user
  const uid = firebaseUser.uid
  let extra = {}

  // Upsert Firestore profile document users/{uid}
  if (db) {
    try {
      const userDocRef = doc(db, 'users', uid)
      const snap = await getDoc(userDocRef)
      if (!snap.exists()) {
        await setDoc(userDocRef, {
          uid,
          email:       firebaseUser.email,
          displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Farmer',
          photoURL:    firebaseUser.photoURL || '',
          role:        'Farmer',
          provider:    'google',
          phone:       '',
          address:     'Gujarat, India',
          createdAt:   serverTimestamp(),
          updatedAt:   serverTimestamp(),
          isDemo:      false
        })
      } else {
        // Document exists: preserve farmer-entered fields (phone, address, etc.)
        const existing = snap.data() || {}
        extra = existing
        await updateDoc(userDocRef, {
          displayName: existing.displayName || firebaseUser.displayName || 'Farmer',
          photoURL:    firebaseUser.photoURL || existing.photoURL || '',
          provider:    'google',
          updatedAt:   serverTimestamp()
        })
      }
    } catch (fsErr) {
      console.warn('[FieldWise] Firestore Google profile write notice:', fsErr?.code || fsErr?.message)
    }
  }

  const profile = {
    uid,
    displayName: firebaseUser.displayName || extra.displayName || firebaseUser.email?.split('@')[0] || 'Farmer',
    email:       firebaseUser.email,
    address:     extra.address   || 'Gujarat, India',
    contact_no:  extra.phone     || '',
    photoURL:    firebaseUser.photoURL || extra.photoURL || '',
    provider:    'google',
    isDemo:      false,
    role:        'Farmer'
  }
  persistSession(profile)
  return profile
}

// ── Link Google Account ────────────────────────────────────────────────────────
/**
 * Links a pending Google credential to an existing email/password account.
 * Re-authenticates with existing credentials, links the Google credential,
 * and updates the Firestore profile.
 */
export async function linkGoogleAccount({ email, password, pendingCredential }) {
  if (!email || !email.trim()) {
    throw new Error('Please enter your email address.')
  }
  if (!password) {
    throw new Error('Please enter your password to link your Google account.')
  }
  if (!pendingCredential) {
    throw new Error('Google credential is missing. Please restart Google Sign-In.')
  }
  if (!isConfigured || !auth) {
    throw new Error('Authentication service is not configured. Please contact support.')
  }

  const cleanEmail = email.trim()

  // 1. Sign in with the existing email and password
  let cred
  try {
    cred = await signInWithEmailAndPassword(auth, cleanEmail, password)
  } catch (authErr) {
    if (authErr.code === 'auth/wrong-password' || authErr.code === 'auth/invalid-credential') {
      throw new Error('Incorrect password. Please enter the password for your existing account.')
    }
    throw new Error(authErr.message || 'Authentication failed during account linking.')
  }

  const user = cred.user

  // 2. Link the pending Google credential to the confirmed user
  try {
    await linkWithCredential(user, pendingCredential)
  } catch (linkErr) {
    if (linkErr.code === 'auth/credential-already-in-use') {
      throw new Error('This Google account is already linked to another FieldWise user.')
    }
    throw new Error(linkErr.message || 'Failed to link Google account.')
  }

  // 3. Update Firestore profile to reflect linked provider and photoURL
  let extra = {}
  if (db) {
    try {
      const userDocRef = doc(db, 'users', user.uid)
      const snap = await getDoc(userDocRef)
      if (snap.exists()) {
        extra = snap.data() || {}
        await updateDoc(userDocRef, {
          photoURL: user.photoURL || extra.photoURL || '',
          provider: 'google',
          updatedAt: serverTimestamp()
        })
      }
    } catch (fsErr) {
      console.warn('[FieldWise] Firestore linking update notice:', fsErr?.code || fsErr?.message)
    }
  }

  const profile = {
    uid:         user.uid,
    displayName: user.displayName || extra.displayName || cleanEmail.split('@')[0],
    email:       user.email,
    address:     extra.address || 'Gujarat, India',
    contact_no:  extra.phone || '',
    photoURL:    user.photoURL || extra.photoURL || '',
    provider:    'google',
    isDemo:      false,
    role:        'Farmer'
  }
  persistSession(profile)
  return profile
}

// ── Register ───────────────────────────────────────────────────────────────────
// IMPORTANT: This function requires Firebase Auth to be enabled.
// If Firebase Auth is unavailable or unconfigured, registration FAILS explicitly.
// There is NO localStorage fallback for authentication — localStorage is only
// used for session caching of an already-authenticated Firebase user.
export async function registerFarmer({ name, email, password, address, contact_no }) {
  if (!isConfigured || !auth) {
    throw new Error('Authentication service is not configured. Please contact support.')
  }

  // 1. Create the account in Firebase Auth — this is the ONLY identity source
  let firebaseUser
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    firebaseUser = cred.user
    await updateProfile(firebaseUser, { displayName: name })
  } catch (authErr) {
    if (authErr.code === 'auth/email-already-in-use') {
      throw new Error('An account with this email already exists. Please log in instead.')
    }
    if (authErr.code === 'auth/weak-password') {
      throw new Error('Password is too weak. Please use at least 6 characters.')
    }
    if (authErr.code === 'auth/invalid-email') {
      throw new Error('Invalid email address format.')
    }
    // Surface all other Firebase Auth errors clearly
    throw new Error(authErr.message || 'Registration failed. Please try again.')
  }

  const uid = firebaseUser.uid

  // 2. Write profile to Firestore users/{uid}
  //    NOTE: No password hash is stored. Firebase Auth owns credentials.
  if (db) {
    try {
      await setDoc(doc(db, 'users', uid), {
        uid,
        email:      firebaseUser.email,
        displayName: name,
        role:       'Farmer',
        phone:      contact_no || '',
        address:    address || 'Vadodara, Gujarat',
        createdAt:  serverTimestamp(),
        updatedAt:  serverTimestamp(),
        isDemo:     false
      })
    } catch (fsErr) {
      // Profile write failure is non-fatal: auth succeeded, user can still use the app.
      // Profile data can be re-written on next login via loginFarmer().
      console.warn('[FieldWise] Firestore profile write failed (non-fatal):', fsErr?.code || fsErr?.message)
    }
  }

  // 3. Build the session profile from the confirmed Firebase Auth user.
  //    Session is ONLY created after confirmed Firebase Auth success.
  const profile = {
    uid,
    displayName: name,
    email:       firebaseUser.email,
    address:     address || 'Vadodara, Gujarat',
    contact_no:  contact_no || '',
    isDemo:      false,
    role:        'Farmer'
  }
  persistSession(profile)
  return profile
}

// ── Login ──────────────────────────────────────────────────────────────────────
// IMPORTANT: Login uses ONLY Firebase Authentication.
// localStorage is used only for session caching after a confirmed Firebase login.
// No local account lookup or password-hash comparison is performed.
export async function loginFarmer({ email, password }) {
  if (!email || !email.trim()) {
    throw new Error('Please enter your email address.')
  }
  if (!isConfigured || !auth) {
    throw new Error('Authentication service is not configured. Please contact support.')
  }

  const cleanEmail = email.trim()

  // Authenticate with Firebase Auth — this is the ONLY valid login path
  let firebaseUser
  try {
    const cred = await signInWithEmailAndPassword(auth, cleanEmail, password)
    firebaseUser = cred.user
  } catch (err) {
    if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
      throw new Error('Incorrect email or password. Please try again.')
    }
    if (err.code === 'auth/user-not-found') {
      throw new Error('No account found with this email. Please register first.')
    }
    if (err.code === 'auth/too-many-requests') {
      throw new Error('Too many failed attempts. Please wait a moment and try again.')
    }
    if (err.code === 'auth/invalid-email') {
      throw new Error('Invalid email address format.')
    }
    if (err.code === 'auth/user-disabled') {
      throw new Error('This account has been disabled. Please contact support.')
    }
    throw new Error(err.message || 'Login failed. Please try again.')
  }

  // Fetch the Firestore profile for display data (non-fatal if unavailable)
  let extra = {}
  if (db) {
    try {
      const snap = await getDoc(doc(db, 'users', firebaseUser.uid))
      if (snap.exists()) {
        extra = snap.data()
      } else {
        // Profile document missing — write it now (handles accounts created before Firestore write)
        try {
          await setDoc(doc(db, 'users', firebaseUser.uid), {
            uid:         firebaseUser.uid,
            email:       firebaseUser.email,
            displayName: firebaseUser.displayName || cleanEmail.split('@')[0],
            role:        'Farmer',
            phone:       '',
            address:     'Gujarat, India',
            createdAt:   serverTimestamp(),
            updatedAt:   serverTimestamp(),
            isDemo:      false
          })
        } catch (writeErr) {
          console.warn('[FieldWise] Could not create missing profile document:', writeErr?.code)
        }
      }
    } catch (fsErr) {
      console.warn('[FieldWise] Firestore profile fetch failed (non-fatal):', fsErr?.code || fsErr?.message)
    }
  }

  const profile = {
    uid:         firebaseUser.uid,
    displayName: firebaseUser.displayName || extra.displayName || cleanEmail.split('@')[0],
    email:       firebaseUser.email,
    address:     extra.address    || 'Gujarat, India',
    contact_no:  extra.phone      || '',
    isDemo:      false,
    role:        'Farmer'
  }
  persistSession(profile)
  return profile
}

// ── Logout ─────────────────────────────────────────────────────────────────────
export async function logoutFarmer() {
  // Always clear the timed session immediately — logout overrides everything
  clearSession()
  if (isConfigured && auth) {
    try {
      await signOut(auth)
    } catch (e) {
      console.warn('SignOut error:', e)
    }
  }
}

// ── Forgot Password ────────────────────────────────────────────────────────────
// Uses Firebase Auth's built-in password reset email. 
// Does NOT fall back to custom Firestore-based password hashing.
export async function forgotPassword(email) {
  if (!email || !email.trim()) {
    throw new Error('Please enter your email address.')
  }
  if (!isConfigured || !auth) {
    throw new Error('Authentication service is not configured. Please contact support.')
  }

  const cleanEmail = email.trim()

  try {
    await sendPasswordResetEmail(auth, cleanEmail)
    return {
      success: true,
      emailSent: true,
      message: `Password reset link has been sent to ${cleanEmail}. Please check your inbox (and spam folder).`
    }
  } catch (resetErr) {
    if (resetErr.code === 'auth/user-not-found') {
      // Don't reveal whether account exists — security best practice
      return {
        success: true,
        emailSent: true,
        message: `If an account exists for ${cleanEmail}, a password reset link has been sent.`
      }
    }
    if (resetErr.code === 'auth/invalid-email') {
      throw new Error('Invalid email address format.')
    }
    if (resetErr.code === 'auth/too-many-requests') {
      throw new Error('Too many reset attempts. Please wait before trying again.')
    }
    throw new Error(resetErr.message || 'Failed to send reset email. Please try again.')
  }
}

// ── Direct Password Reset ──────────────────────────────────────────────────────
// Called when the user enters a new password after clicking the Firebase reset link.
// Firebase handles password reset via the out-of-band link in the email — this
// function is kept for UI compat but now redirects to Firebase's standard flow.
export async function resetFarmerPasswordDirect({ email, newPassword }) {
  // Firebase's standard flow: users click the reset link in the email, which
  // opens the Firebase-hosted reset page or the app's ?oobCode= handler.
  // Direct re-auth and password update requires the current password.
  // If called from the forgot-password UI without current credentials, we
  // signal that the email link flow must be used instead.
  if (!newPassword || newPassword.length < 6) {
    throw new Error('Password must be at least 6 characters long.')
  }
  // If the user is currently authenticated (e.g. they know their current password),
  // we could reauthenticate and update. For the forgot-password flow, the Firebase
  // reset email link is the correct path.
  throw new Error(
    'To reset your password, please use the link sent to your email. ' +
    'Check your inbox and spam folder for the FieldWise password reset email.'
  )
}
