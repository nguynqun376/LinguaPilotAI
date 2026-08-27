import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  deleteDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile, SyncState, AdminUserItem } from './accountSync';

// Sanitize email to form safe firestore doc IDs
export function sanitizeEmailKey(email: string): string {
  return email.trim().toLowerCase().replace(/[^a-z0-9@._-]/g, '_');
}

/**
 * 1. Firebase Auth/Account Registration
 */
export async function registerFirebaseAccount(
  email: string,
  password: string,
  name: string,
  targetLanguage: string,
  level: string
): Promise<{ success: boolean; user?: UserProfile; message: string }> {
  try {
    const cleanEmail = email.trim().toLowerCase();
    const docId = sanitizeEmailKey(cleanEmail);
    const userDocRef = doc(db, 'users', docId);

    const existingSnap = await getDoc(userDocRef);
    if (existingSnap.exists()) {
      return { success: false, message: 'Email này đã được đăng ký tài khoản. Vui lòng đăng nhập.' };
    }

    const isAdmin = cleanEmail === 'minhquankt298@gmail.com';
    const profileData = {
      email: cleanEmail,
      name: name?.trim() || cleanEmail.split('@')[0],
      password: password,
      role: isAdmin ? 'admin' : 'learner',
      targetLanguage: targetLanguage || 'English',
      level: level || 'Intermediate',
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
    };

    await setDoc(userDocRef, profileData);

    const { password: _, ...safeUser } = profileData as any;
    return {
      success: true,
      message: isAdmin ? 'Khởi tạo tài khoản Quản trị viên thành công qua Firebase!' : 'Đăng ký tài khoản thành công qua Firebase!',
      user: safeUser,
    };
  } catch (err: any) {
    console.error('Firebase register error:', err);
    return { success: false, message: err.message || 'Lỗi kết nối Firebase Firestore.' };
  }
}

/**
 * 2. Firebase Account Login
 */
export async function loginFirebaseAccount(
  email: string,
  password: string
): Promise<{ success: boolean; user?: UserProfile; message: string }> {
  try {
    const cleanEmail = email.trim().toLowerCase();
    const docId = sanitizeEmailKey(cleanEmail);
    const userDocRef = doc(db, 'users', docId);

    const snap = await getDoc(userDocRef);
    if (!snap.exists()) {
      // If admin account was not yet written into firestore, auto-bootstrap it
      if (cleanEmail === 'minhquankt298@gmail.com') {
        const adminProfile = {
          email: cleanEmail,
          name: 'Minh Quân (Quản Trị Viên)',
          password: 'Quan29810',
          role: 'admin',
          targetLanguage: 'System Administration & Academic Research',
          level: 'Mastery / C2',
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
        };
        await setDoc(userDocRef, adminProfile);
        if (password === 'Quan29810') {
          const { password: _, ...safeAdmin } = adminProfile as any;
          return { success: true, message: 'Đăng nhập thành công với quyền Quản Trị Viên!', user: safeAdmin };
        }
      }
      return { success: false, message: 'Tài khoản không tồn tại trên hệ thống.' };
    }

    const userData = snap.data();
    if (userData.password !== password) {
      return { success: false, message: 'Mật khẩu không chính xác.' };
    }

    // Update last login
    await updateDoc(userDocRef, {
      lastLogin: new Date().toISOString(),
    });

    const { password: _, ...safeUser } = userData as any;
    return {
      success: true,
      message: safeUser.role === 'admin' ? 'Đăng nhập thành công với quyền Quản Trị Viên!' : 'Đăng nhập thành công!',
      user: safeUser,
    };
  } catch (err: any) {
    console.error('Firebase login error:', err);
    return { success: false, message: err.message || 'Lỗi xác thực với Firebase.' };
  }
}

/**
 * 3. Update User Profile in Firebase
 */
export async function updateFirebaseProfile(
  email: string,
  name?: string,
  targetLanguage?: string,
  level?: string,
  newPassword?: string
): Promise<{ success: boolean; user?: UserProfile; message: string }> {
  try {
    const cleanEmail = email.trim().toLowerCase();
    const docId = sanitizeEmailKey(cleanEmail);
    const userDocRef = doc(db, 'users', docId);

    const updatePayload: Record<string, any> = {
      updatedAt: new Date().toISOString(),
    };
    if (name) updatePayload.name = name.trim();
    if (targetLanguage) updatePayload.targetLanguage = targetLanguage;
    if (level) updatePayload.level = level;
    if (newPassword && newPassword.length >= 4) updatePayload.password = newPassword;

    await updateDoc(userDocRef, updatePayload);
    const updatedSnap = await getDoc(userDocRef);
    const { password: _, ...safeUser } = updatedSnap.data() as any;

    return { success: true, message: 'Cập nhật hồ sơ thành công!', user: safeUser };
  } catch (err: any) {
    console.error('Firebase update profile error:', err);
    return { success: false, message: err.message || 'Lỗi cập nhật Firestore.' };
  }
}

/**
 * 4. Save Study Data into Firebase Firestore
 */
export async function saveStudyDataToFirebase(
  email: string,
  state: SyncState
): Promise<{ success: boolean; message: string }> {
  try {
    const cleanEmail = email.trim().toLowerCase();
    const docId = sanitizeEmailKey(cleanEmail);
    const studyDocRef = doc(db, 'study_data', docId);

    const payload = {
      email: cleanEmail,
      updatedAt: new Date().toISOString(),
      ...state,
    };

    await setDoc(studyDocRef, payload, { merge: true });
    return { success: true, message: 'Dữ liệu học tập đã lưu bền vững trên Firebase Firestore!' };
  } catch (err: any) {
    console.error('Firebase save study data error:', err);
    return { success: false, message: err.message || 'Lỗi lưu Firestore.' };
  }
}

/**
 * 5. Load Study Data from Firebase Firestore
 */
export async function loadStudyDataFromFirebase(
  email: string
): Promise<{ success: boolean; data?: SyncState; message: string }> {
  try {
    const cleanEmail = email.trim().toLowerCase();
    const docId = sanitizeEmailKey(cleanEmail);
    const studyDocRef = doc(db, 'study_data', docId);

    const snap = await getDoc(studyDocRef);
    if (snap.exists()) {
      return { success: true, data: snap.data() as SyncState, message: 'Tải dữ liệu thành công từ Firebase Firestore!' };
    }
    return { success: false, message: 'Chưa có dữ liệu trên Firestore cho tài khoản này.' };
  } catch (err: any) {
    console.error('Firebase load study data error:', err);
    return { success: false, message: err.message || 'Lỗi tải Firestore.' };
  }
}

/**
 * 6. Admin: Get all learners & telemetry across Firebase
 */
export async function fetchAdminUsersFromFirebase(): Promise<{
  success: boolean;
  users: AdminUserItem[];
  totalUsers: number;
  message?: string;
}> {
  try {
    const usersColRef = collection(db, 'users');
    const usersSnap = await getDocs(usersColRef);

    const userList: AdminUserItem[] = [];

    for (const uDoc of usersSnap.docs) {
      const uData = uDoc.data();
      const { password, ...safeUser } = uData as any;
      const docId = uDoc.id;

      let stats = {
        hasData: false,
        tasksCount: 0,
        tasksCompleted: 0,
        completionRate: 0,
        reflectionsCount: 0,
        avgReflectionScore: 0,
        speakingEvaluationsCount: 0,
        socraticHints: 0,
        directAnswers: 0,
        studyLogsCount: 0,
        totalStudyMinutes: 0,
        primaryGoal: safeUser.targetLanguage || 'Chưa thiết lập',
        lastSync: safeUser.lastLogin || safeUser.createdAt,
      };

      try {
        const studyDocRef = doc(db, 'study_data', docId);
        const studySnap = await getDoc(studyDocRef);
        if (studySnap.exists()) {
          const rawData = studySnap.data() as any;
          stats.hasData = true;
          stats.lastSync = rawData.updatedAt || stats.lastSync;

          if (rawData.roadmap) {
            const allTasks = rawData.roadmap.tasks || [];
            if (rawData.roadmap.weeks) {
              rawData.roadmap.weeks.forEach((w: any) => {
                if (w.tasks) allTasks.push(...w.tasks);
              });
            }
            const uniqueTasks = Array.from(new Map(allTasks.map((t: any) => [t.id, t])).values());
            stats.tasksCount = uniqueTasks.length;
            stats.tasksCompleted = uniqueTasks.filter((t: any) => t.status === 'Completed' || t.status === 'completed').length;
            stats.completionRate = stats.tasksCount > 0 ? Math.round((stats.tasksCompleted / stats.tasksCount) * 100) : 0;
          }

          if (Array.isArray(rawData.reflections)) {
            stats.reflectionsCount = rawData.reflections.length;
            const scores = rawData.reflections
              .map((r: any) => r.effectivenessScore || r.confidenceRating * 20)
              .filter((s: number) => !isNaN(s) && s > 0);
            if (scores.length > 0) {
              stats.avgReflectionScore = Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length);
            }
          }

          stats.socraticHints = rawData.socraticHints || 0;
          stats.directAnswers = rawData.directAnswers || 0;
          stats.speakingEvaluationsCount = rawData.speakingEvaluationsCount || 0;

          if (Array.isArray(rawData.studyLogs)) {
            stats.studyLogsCount = rawData.studyLogs.length;
            stats.totalStudyMinutes = rawData.studyLogs.reduce((acc: number, log: any) => acc + (log.durationMinutes || 0), 0);
          }

          if (rawData.userGoal?.primaryGoal) {
            stats.primaryGoal = rawData.userGoal.primaryGoal;
          }
        }
      } catch (e) {
        console.error('Error fetching student study data from Firebase:', e);
      }

      userList.push({
        ...safeUser,
        stats,
      });
    }

    return {
      success: true,
      users: userList,
      totalUsers: userList.length,
    };
  } catch (err: any) {
    console.error('Fetch admin users error:', err);
    return { success: false, users: [], totalUsers: 0, message: err.message };
  }
}

/**
 * 7. Admin: Delete User from Firebase
 */
export async function deleteUserFromFirebase(email: string): Promise<{ success: boolean; message: string }> {
  try {
    const cleanEmail = email.trim().toLowerCase();
    if (cleanEmail === 'minhquankt298@gmail.com') {
      return { success: false, message: 'Không thể xóa tài khoản Quản trị viên tối cao.' };
    }

    const docId = sanitizeEmailKey(cleanEmail);
    await deleteDoc(doc(db, 'users', docId));
    try {
      await deleteDoc(doc(db, 'study_data', docId));
    } catch (e) {}

    return { success: true, message: `Đã xóa tài khoản ${cleanEmail} khỏi Firebase Firestore!` };
  } catch (err: any) {
    console.error('Firebase delete user error:', err);
    return { success: false, message: err.message || 'Lỗi khi xóa người dùng.' };
  }
}
