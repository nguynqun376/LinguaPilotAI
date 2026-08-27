/**
 * Dual Persistence & High-Resilience Layer: Firebase Cloud Firestore + High-Speed Fallback API
 */

import {
  registerFirebaseAccount,
  loginFirebaseAccount,
  updateFirebaseProfile,
  saveStudyDataToFirebase,
  loadStudyDataFromFirebase,
  fetchAdminUsersFromFirebase,
  deleteUserFromFirebase
} from './firebaseSync';

export interface UserProfile {
  email: string;
  name: string;
  targetLanguage: string;
  level: string;
  role?: 'admin' | 'learner';
  createdAt: string;
  lastLogin?: string;
  updatedAt?: string;
}

export interface AdminUserItem extends UserProfile {
  stats: {
    hasData: boolean;
    tasksCount: number;
    tasksCompleted: number;
    completionRate: number;
    reflectionsCount: number;
    avgReflectionScore: number;
    speakingEvaluationsCount: number;
    socraticHints: number;
    directAnswers: number;
    studyLogsCount: number;
    totalStudyMinutes: number;
    primaryGoal: string;
    lastSync: string;
  };
}

export interface SyncState {
  userGoal: any;
  roadmap: any;
  reflections: any[];
  studyLogs: any[];
  researchGroup: string;
  telemetryLogs: any[];
  socraticHints: number;
  directAnswers: number;
  speakingEvaluationsCount: number;
  updatedAt?: string;
}

// 1. Auth: Register (Tries Firebase Firestore first, replicates to server for cache/redundancy)
export async function registerAccount(
  email: string,
  password: string,
  name: string,
  targetLanguage: string,
  level: string
): Promise<{ success: boolean; user?: UserProfile; message: string }> {
  try {
    const fbRes = await registerFirebaseAccount(email, password, name, targetLanguage, level);
    if (fbRes.success) {
      // Replicate to backend for redundancy
      fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name, targetLanguage, level }),
      }).catch(() => {});
      return fbRes;
    }
    // If Firebase returned a validation message like 'already exists'
    if (fbRes.message && fbRes.message.includes('đã được đăng ký')) {
      return fbRes;
    }
  } catch (e) {
    console.warn("Falling back to server register:", e);
  }

  // Fallback to local server API
  try {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name, targetLanguage, level }),
    });
    const result = await res.json();
    if (res.ok && result.success) {
      return { success: true, user: result.user, message: result.message };
    }
    return { success: false, message: result.error || "Không thể đăng ký tài khoản." };
  } catch (error: any) {
    return { success: false, message: error.message || "Lỗi mạng khi kết nối máy chủ." };
  }
}

// 2. Auth: Login (Tries Firebase Firestore first, syncs to server)
export async function loginAccount(
  email: string,
  password: string
): Promise<{ success: boolean; user?: UserProfile; message: string }> {
  try {
    const fbRes = await loginFirebaseAccount(email, password);
    if (fbRes.success) {
      // Background sync to server cache
      fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      }).catch(() => {});
      return fbRes;
    }
    if (fbRes.message && (fbRes.message.includes('Mật khẩu không chính xác') || fbRes.message.includes('không tồn tại'))) {
      // Fallback try server check if recently created on server
    }
  } catch (e) {
    console.warn("Falling back to server login:", e);
  }

  // Fallback to local server API
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const result = await res.json();
    if (res.ok && result.success) {
      return { success: true, user: result.user, message: result.message };
    }
    return { success: false, message: result.error || "Không thể đăng nhập." };
  } catch (error: any) {
    return { success: false, message: error.message || "Lỗi mạng khi kết nối máy chủ." };
  }
}

// 3. Auth: Update Profile
export async function updateAccountProfile(
  email: string,
  name?: string,
  targetLanguage?: string,
  level?: string,
  newPassword?: string
): Promise<{ success: boolean; user?: UserProfile; message: string }> {
  try {
    const fbRes = await updateFirebaseProfile(email, name, targetLanguage, level, newPassword);
    if (fbRes.success) {
      fetch("/api/auth/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, targetLanguage, level, newPassword }),
      }).catch(() => {});
      return fbRes;
    }
  } catch (e) {
    console.warn("Firebase update fallback to server:", e);
  }

  try {
    const res = await fetch("/api/auth/update-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name, targetLanguage, level, newPassword }),
    });
    const result = await res.json();
    if (res.ok && result.success) {
      return { success: true, user: result.user, message: result.message };
    }
    return { success: false, message: result.error || "Không thể cập nhật hồ sơ." };
  } catch (error: any) {
    return { success: false, message: error.message || "Lỗi mạng khi cập nhật hồ sơ." };
  }
}

// 4. Auth: Fetch list of registered accounts
export async function fetchRegisteredAccounts(): Promise<UserProfile[]> {
  try {
    const res = await fetch("/api/auth/accounts");
    const result = await res.json();
    if (res.ok && result.success && Array.isArray(result.accounts)) {
      return result.accounts;
    }
    return [];
  } catch (e) {
    return [];
  }
}

// 5. Data: Save Study State (Redundant Multi-Storage: Firebase + Server)
export async function saveStateToServer(email: string, state: SyncState): Promise<{ success: boolean; message: string }> {
  let fbSuccess = false;
  try {
    const fbRes = await saveStudyDataToFirebase(email, state);
    if (fbRes.success) {
      fbSuccess = true;
    }
  } catch (e) {
    console.warn("Firebase save error, falling back to server:", e);
  }

  // Save to Express Backend as well for automatic failover/redundancy
  try {
    const response = await fetch("/api/user-data/save", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, data: state }),
    });
    const result = await response.json();
    if (response.ok && result.success) {
      return {
        success: true,
        message: fbSuccess
          ? "Dữ liệu học tập đã được lưu trữ bền vững trên Firebase Cloud Firestore!"
          : result.message,
      };
    } else if (fbSuccess) {
      return { success: true, message: "Dữ liệu đã lưu thành công vào Firebase Firestore!" };
    } else {
      return { success: false, message: result.error || "Không thể lưu trữ dữ liệu." };
    }
  } catch (error: any) {
    if (fbSuccess) {
      return { success: true, message: "Dữ liệu đã lưu trên Firebase Firestore!" };
    }
    return { success: false, message: error.message || "Lỗi mạng khi lưu dữ liệu." };
  }
}

// 6. Data: Load Study State
export async function loadStateFromServer(email: string): Promise<{ success: boolean; data?: SyncState; message: string }> {
  try {
    const fbRes = await loadStudyDataFromFirebase(email);
    if (fbRes.success && fbRes.data) {
      return fbRes;
    }
  } catch (e) {
    console.warn("Firebase load failed, trying server cache:", e);
  }

  try {
    const response = await fetch(`/api/user-data/load?email=${encodeURIComponent(email)}`);
    const result = await response.json();
    if (response.ok && result.success && result.data) {
      return { success: true, data: result.data, message: "Tải dữ liệu thành công từ bộ nhớ máy chủ!" };
    } else {
      return { success: false, message: result.error || "Không tìm thấy dữ liệu." };
    }
  } catch (error: any) {
    console.error("Network error loading state:", error);
    return { success: false, message: error.message || "Lỗi mạng khi tải dữ liệu." };
  }
}

// 7. Admin: Fetch All Users (Combines Firebase Firestore & Server Records)
export async function fetchAdminUsers(): Promise<{ success: boolean; users: AdminUserItem[]; totalUsers: number; message?: string }> {
  try {
    const fbRes = await fetchAdminUsersFromFirebase();
    if (fbRes.success && fbRes.users.length > 0) {
      return fbRes;
    }
  } catch (e) {
    console.warn("Firebase admin fetch fallback:", e);
  }

  try {
    const res = await fetch("/api/admin/users");
    const result = await res.json();
    if (res.ok && result.success) {
      return { success: true, users: result.users || [], totalUsers: result.totalUsers || 0 };
    }
    return { success: false, users: [], totalUsers: 0, message: result.error || "Không thể tải danh sách người dùng." };
  } catch (err: any) {
    return { success: false, users: [], totalUsers: 0, message: err.message || "Lỗi mạng kết nối máy chủ." };
  }
}

// 8. Admin: Fetch Single Learner Detail
export async function fetchAdminUserDetail(email: string): Promise<{ success: boolean; user?: UserProfile; studyData?: SyncState; message?: string }> {
  try {
    const res = await fetch(`/api/admin/user/${encodeURIComponent(email)}`);
    const result = await res.json();
    if (res.ok && result.success) {
      return { success: true, user: result.user, studyData: result.studyData };
    }
    return { success: false, message: result.error || "Không thể tải chi tiết học viên." };
  } catch (err: any) {
    return { success: false, message: err.message || "Lỗi mạng khi lấy dữ liệu." };
  }
}

// 9. Admin: Export All Student Data
export async function fetchAdminExportBundle(): Promise<{ success: boolean; data?: any; message?: string }> {
  try {
    const res = await fetch("/api/admin/export-all");
    const result = await res.json();
    if (res.ok) {
      return { success: true, data: result };
    }
    return { success: false, message: result.error || "Không thể xuất dữ liệu." };
  } catch (err: any) {
    return { success: false, message: err.message || "Lỗi mạng khi xuất dữ liệu." };
  }
}

// 10. Admin: Delete User
export async function deleteUserAccount(email: string): Promise<{ success: boolean; message: string }> {
  try {
    await deleteUserFromFirebase(email);
  } catch (e) {}

  try {
    const res = await fetch(`/api/admin/user/${encodeURIComponent(email)}`, {
      method: "DELETE",
    });
    const result = await res.json();
    if (res.ok && result.success) {
      return { success: true, message: result.message };
    }
    return { success: false, message: result.error || "Không thể xóa tài khoản." };
  } catch (err: any) {
    return { success: false, message: err.message || "Lỗi mạng khi xóa tài khoản." };
  }
}

export interface TranslationSet {
  accountTitle: string;
  tabLogin: string;
  tabRegister: string;
  tabProfile: string;
  emailLabel: string;
  emailPlaceholder: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  nameLabel: string;
  namePlaceholder: string;
  targetLangLabel: string;
  levelLabel: string;
  btnRegister: string;
  btnLogin: string;
  btnLogout: string;
  btnSaveData: string;
  btnLoadData: string;
  btnUpdateProfile: string;
  statusSaving: string;
  statusLoading: string;
  notifEnterEmail: string;
  notifSaved: string;
  notifLoaded: string;
  notifLoadError: string;
  notifError: string;
  welcomeBack: string;
  accountCreated: string;
  guestBadge: string;
  loggedInBadge: string;
  learnerRole: string;
  recentAccounts: string;
  cloudSyncLabel: string;
  lastSynced: string;
  autoSaveEnabled: string;
  registeredOn: string;
  switchAccount: string;
}

export const syncTranslations: Record<string, TranslationSet> = {
  vi: {
    accountTitle: "Quản lý Tài khoản & Dữ liệu",
    tabLogin: "Đăng nhập",
    tabRegister: "Tạo tài khoản mới",
    tabProfile: "Hồ sơ học viên",
    emailLabel: "Địa chỉ Email",
    emailPlaceholder: "nhap.email.cua.ban@gmail.com",
    passwordLabel: "Mật khẩu bảo vệ",
    passwordPlaceholder: "Nhập mật khẩu (tối thiểu 4 ký tự)...",
    nameLabel: "Họ và tên học viên",
    namePlaceholder: "Ví dụ: Nguyễn Văn A",
    targetLangLabel: "Mục tiêu học tập",
    levelLabel: "Trình độ hiện tại",
    btnRegister: "Đăng ký tài khoản",
    btnLogin: "Đăng nhập ngay",
    btnLogout: "Đăng xuất tài khoản",
    btnSaveData: "Lưu dữ liệu theo Email",
    btnLoadData: "Tải dữ liệu từ Email",
    btnUpdateProfile: "Cập nhật hồ sơ",
    statusSaving: "Đang lưu trữ dữ liệu lên Firebase Firestore...",
    statusLoading: "Đang tải dữ liệu hồ sơ học tập...",
    notifEnterEmail: "Vui lòng nhập địa chỉ email hợp lệ.",
    notifSaved: "Dữ liệu học tập đã được lưu trữ an toàn trên Firebase!",
    notifLoaded: "Đã tải thành công lộ trình và dữ liệu học tập!",
    notifLoadError: "Chưa tìm thấy dữ liệu học tập cho email này.",
    notifError: "Đã xảy ra lỗi khi đồng bộ dữ liệu.",
    welcomeBack: "Chào mừng bạn trở lại,",
    accountCreated: "Tài khoản học viên đã được khởi tạo thành công trên Firebase!",
    guestBadge: "Chế độ Khách",
    loggedInBadge: "Đã kết nối Firebase & Email",
    learnerRole: "Học viên Tự học (SDL Learner)",
    recentAccounts: "Tài khoản đã đăng ký trên thiết bị:",
    cloudSyncLabel: "Đồng bộ Firebase Cloud",
    lastSynced: "Đồng bộ lần cuối:",
    autoSaveEnabled: "Tự động lưu sau mỗi hoạt động",
    registeredOn: "Ngày tham gia:",
    switchAccount: "Chuyển tài khoản",
  },
  en: {
    accountTitle: "Account & Data Management",
    tabLogin: "Sign In",
    tabRegister: "Create Account",
    tabProfile: "Learner Profile",
    emailLabel: "Email Address",
    emailPlaceholder: "your.email@example.com",
    passwordLabel: "Account Password",
    passwordPlaceholder: "Enter password (min 4 characters)...",
    nameLabel: "Learner Name",
    namePlaceholder: "e.g., Alex Johnson",
    targetLangLabel: "Learning Target",
    levelLabel: "Current Proficiency",
    btnRegister: "Create Account",
    btnLogin: "Sign In",
    btnLogout: "Sign Out",
    btnSaveData: "Save Data to Firebase",
    btnLoadData: "Load Data from Firebase",
    btnUpdateProfile: "Update Profile",
    statusSaving: "Saving study records to Firebase Firestore...",
    statusLoading: "Loading study records...",
    notifEnterEmail: "Please enter a valid email address.",
    notifSaved: "Study records successfully saved to Firebase Firestore!",
    notifLoaded: "Successfully loaded your learning journey!",
    notifLoadError: "No study records found for this email.",
    notifError: "An error occurred during synchronization.",
    welcomeBack: "Welcome back,",
    accountCreated: "Your learner account has been created on Firebase!",
    guestBadge: "Guest Mode",
    loggedInBadge: "Connected to Firebase",
    learnerRole: "SDL Autonomous Learner",
    recentAccounts: "Registered accounts:",
    cloudSyncLabel: "Firebase Cloud Sync",
    lastSynced: "Last synced:",
    autoSaveEnabled: "Auto-save active on updates",
    registeredOn: "Joined:",
    switchAccount: "Switch Account",
  },
  zh: {
    accountTitle: "账号与数据中心",
    tabLogin: "登录",
    tabRegister: "创建新账号",
    tabProfile: "学员档案",
    emailLabel: "电子邮箱",
    emailPlaceholder: "your.email@example.com",
    passwordLabel: "账号密码",
    passwordPlaceholder: "输入密码（至少4个字符）...",
    nameLabel: "学员姓名",
    namePlaceholder: "例如：张明",
    targetLangLabel: "学习目标",
    levelLabel: "当前等级",
    btnRegister: "立即注册",
    btnLogin: "立即登录",
    btnLogout: "退出登录",
    btnSaveData: "保存数据至 Firebase",
    btnLoadData: "从 Firebase 加载数据",
    btnUpdateProfile: "更新档案",
    statusSaving: "正在保存至 Firebase Firestore...",
    statusLoading: "正在加载学习数据...",
    notifEnterEmail: "请输入有效的电子邮箱地址。",
    notifSaved: "学习数据已成功保存至 Firebase！",
    notifLoaded: "成功加载您的专属学习历程！",
    notifLoadError: "未找到该邮箱的学习记录。",
    notifError: "同步数据时发生错误。",
    welcomeBack: "欢迎回来，",
    accountCreated: "学员账号已在 Firebase 创建成功！",
    guestBadge: "访客模式",
    loggedInBadge: "已关联 Firebase",
    learnerRole: "自主学习者 (SDL Learner)",
    recentAccounts: "已注册账号：",
    cloudSyncLabel: "Firebase 云端同步",
    lastSynced: "最后同步：",
    autoSaveEnabled: "自动保存已开启",
    registeredOn: "注册时间：",
    switchAccount: "切换账号",
  },
  pt: {
    accountTitle: "Gerenciamento de Conta e Dados",
    tabLogin: "Entrar",
    tabRegister: "Criar Conta",
    tabProfile: "Perfil do Aluno",
    emailLabel: "Endereço de E-mail",
    emailPlaceholder: "seu.email@exemplo.com",
    passwordLabel: "Senha",
    passwordPlaceholder: "Digite sua senha (mínimo 4 caracteres)...",
    nameLabel: "Nome do Aluno",
    namePlaceholder: "ex: Carlos Silva",
    targetLangLabel: "Objetivo de Estudo",
    levelLabel: "Nível Atual",
    btnRegister: "Criar Conta",
    btnLogin: "Entrar",
    btnLogout: "Sair",
    btnSaveData: "Salvar Dados no Firebase",
    btnLoadData: "Carregar Dados do Firebase",
    btnUpdateProfile: "Atualizar Perfil",
    statusSaving: "Salvando registros no Firebase Firestore...",
    statusLoading: "Carregando registros...",
    notifEnterEmail: "Por favor, digite um e-mail válido.",
    notifSaved: "Histórico salvo com sucesso no Firebase!",
    notifLoaded: "Progresso carregado com sucesso!",
    notifLoadError: "Nenhum histórico encontrado para este e-mail.",
    notifError: "Ocorreu um erro ao sincronizar.",
    welcomeBack: "Bem-vindo de volta,",
    accountCreated: "Conta criada com sucesso no Firebase!",
    guestBadge: "Modo Convidado",
    loggedInBadge: "Firebase Conectado",
    learnerRole: "Estudante Autônomo SDL",
    recentAccounts: "Contas registradas:",
    cloudSyncLabel: "Sincronização Firebase Cloud",
    lastSynced: "Última sincronização:",
    autoSaveEnabled: "Salvamento automático ativado",
    registeredOn: "Cadastrado em:",
    switchAccount: "Trocar de Conta",
  },
  es: {
    accountTitle: "Gestión de Cuenta y Datos",
    tabLogin: "Iniciar Sesión",
    tabRegister: "Crear Cuenta",
    tabProfile: "Perfil del Alumno",
    emailLabel: "Correo Electrónico",
    emailPlaceholder: "tu.correo@ejemplo.com",
    passwordLabel: "Contraseña",
    passwordPlaceholder: "Ingresa tu contraseña (mínimo 4 caracteres)...",
    nameLabel: "Nombre del Alumno",
    namePlaceholder: "ej: María Gómez",
    targetLangLabel: "Objetivo de Aprendizaje",
    levelLabel: "Nivel Actual",
    btnRegister: "Crear Cuenta",
    btnLogin: "Iniciar Sesión",
    btnLogout: "Cerrar Sesión",
    btnSaveData: "Guardar Datos en Firebase",
    btnLoadData: "Cargar Datos de Firebase",
    btnUpdateProfile: "Actualizar Perfil",
    statusSaving: "Guardando datos en Firebase Firestore...",
    statusLoading: "Cargando datos de estudio...",
    notifEnterEmail: "Por favor, ingresa un correo electrónico válido.",
    notifSaved: "¡Datos guardados con éxito en Firebase!",
    notifLoaded: "¡Progreso de aprendizaje cargado con éxito!",
    notifLoadError: "No se encontraron datos para este correo.",
    notifError: "Ocurrió un error al sincronizar los datos.",
    welcomeBack: "Bienvenido de nuevo,",
    accountCreated: "¡Cuenta creada exitosamente en Firebase!",
    guestBadge: "Modo Invitado",
    loggedInBadge: "Firebase Conectado",
    learnerRole: "Estudiante Autónomo SDL",
    recentAccounts: "Cuentas registradas:",
    cloudSyncLabel: "Sincronización Firebase Cloud",
    lastSynced: "Última sincronización:",
    autoSaveEnabled: "Guardado automático activo",
    registeredOn: "Registrado el:",
    switchAccount: "Cambiar de Cuenta",
  },
  fr: {
    accountTitle: "Gestion du Compte et Données",
    tabLogin: "Connexion",
    tabRegister: "Créer un Compte",
    tabProfile: "Profil de l'Élève",
    emailLabel: "Adresse E-mail",
    emailPlaceholder: "votre.email@exemple.com",
    passwordLabel: "Mot de Passe",
    passwordPlaceholder: "Entrez un mot de passe (min 4 caractères)...",
    nameLabel: "Nom de l'Élève",
    namePlaceholder: "ex : Julien Dupont",
    targetLangLabel: "Objectif d'Apprentissage",
    levelLabel: "Niveau Actuel",
    btnRegister: "Créer le Compte",
    btnLogin: "Se Connecter",
    btnLogout: "Déconnexion",
    btnSaveData: "Sauvegarder sur Firebase",
    btnLoadData: "Charger depuis Firebase",
    btnUpdateProfile: "Mettre à Jour",
    statusSaving: "Sauvegarde sur Firebase Firestore...",
    statusLoading: "Chargement des données...",
    notifEnterEmail: "Veuillez entrer une adresse e-mail valide.",
    notifSaved: "Données sauvegardées avec succès sur Firebase !",
    notifLoaded: "Parcours d'apprentissage chargé avec succès !",
    notifLoadError: "Aucune donnée trouvée pour cet e-mail.",
    notifError: "Une erreur est survenue lors de la synchronisation.",
    welcomeBack: "Bienvenue,",
    accountCreated: "Compte créé avec succès sur Firebase !",
    guestBadge: "Mode Invité",
    loggedInBadge: "Firebase Connecté",
    learnerRole: "Apprenant Autonome SDL",
    recentAccounts: "Comptes enregistrés :",
    cloudSyncLabel: "Synchronisation Firebase Cloud",
    lastSynced: "Dernière synchro :",
    autoSaveEnabled: "Sauvegarde automatique active",
    registeredOn: "Inscrit le :",
    switchAccount: "Changer de Compte",
  },
};
