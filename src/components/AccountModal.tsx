import React, { useState, useEffect } from 'react';
import {
  User,
  Mail,
  Lock,
  UserPlus,
  LogIn,
  LogOut,
  Cloud,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  X,
  ShieldCheck,
  Eye,
  EyeOff
} from 'lucide-react';
import {
  UserProfile,
  SyncState,
  registerAccount,
  loginAccount,
  updateAccountProfile,
  saveStateToServer,
  loadStateFromServer,
  syncTranslations
} from '../utils/accountSync';
import { Language } from '../utils/translations';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  onUserChange: (user: UserProfile | null) => void;
  language: Language;
  currentState: SyncState;
  onStateRestore: (restoredState: SyncState) => void;
  onNotify: (type: 'success' | 'error' | 'loading', message: string) => void;
  onOpenAdminConsole?: () => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUserChange,
  language,
  currentState,
  onStateRestore,
  onNotify,
  onOpenAdminConsole
}) => {
  const [tab, setTab] = useState<'profile' | 'login' | 'register'>(currentUser ? 'profile' : 'login');
  const t = syncTranslations[language] || syncTranslations.en;

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('English (Academic IELTS)');
  const [level, setLevel] = useState('Intermediate (B2)');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Password visibility states
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Profile Edit states
  const [editName, setEditName] = useState(currentUser?.name || '');
  const [editTargetLang, setEditTargetLang] = useState(currentUser?.targetLanguage || 'English');
  const [editLevel, setEditLevel] = useState(currentUser?.level || 'Intermediate');
  const [newPassword, setNewPassword] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setTab('profile');
      setEditName(currentUser.name);
      setEditTargetLang(currentUser.targetLanguage);
      setEditLevel(currentUser.level);
    } else {
      setTab('login');
    }
  }, [currentUser, isOpen]);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      setEmail('');
      setPassword('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle Registration
  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setErrorMsg(t.notifEnterEmail);
      return;
    }
    if (!password || password.length < 4) {
      setErrorMsg('Vui lòng nhập mật khẩu tối thiểu 4 ký tự.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    const res = await registerAccount(email, password, name, targetLanguage, level);
    setLoading(false);

    if (res.success && res.user) {
      onUserChange(res.user);
      onNotify('success', t.accountCreated);
      
      // Auto-save current learning data to the newly created account
      await saveStateToServer(res.user.email, currentState);
      setTab('profile');
    } else {
      setErrorMsg(res.message || t.notifError);
    }
  }

  // Handle Login
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setErrorMsg(t.notifEnterEmail);
      return;
    }
    if (!password) {
      setErrorMsg('Vui lòng nhập mật khẩu của bạn.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    const res = await loginAccount(email, password);
    setLoading(false);

    if (res.success && res.user) {
      onUserChange(res.user);
      onNotify('success', `${t.welcomeBack} ${res.user.name || res.user.email}!`);
      
      // Auto load data for this user
      const dataRes = await loadStateFromServer(res.user.email);
      if (dataRes.success && dataRes.data) {
        onStateRestore(dataRes.data);
      }
      setTab('profile');
    } else {
      setErrorMsg(res.message || t.notifError);
    }
  }

  // Handle Manual Save to Server
  async function handleSaveData() {
    if (!currentUser) return;
    setLoading(true);
    const res = await saveStateToServer(currentUser.email, currentState);
    setLoading(false);
    if (res.success) {
      onNotify('success', t.notifSaved);
    } else {
      onNotify('error', res.message || t.notifError);
    }
  }

  // Handle Manual Load from Server
  async function handleLoadData() {
    if (!currentUser) return;
    setLoading(true);
    const res = await loadStateFromServer(currentUser.email);
    setLoading(false);
    if (res.success && res.data) {
      onStateRestore(res.data);
      onNotify('success', t.notifLoaded);
    } else {
      onNotify('error', res.message || t.notifLoadError);
    }
  }

  // Handle Profile Update
  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUser) return;
    setIsSavingProfile(true);
    const res = await updateAccountProfile(
      currentUser.email,
      editName,
      editTargetLang,
      editLevel,
      newPassword || undefined
    );
    setIsSavingProfile(false);
    if (res.success && res.user) {
      onUserChange(res.user);
      setNewPassword('');
      onNotify('success', 'Cập nhật hồ sơ thành công!');
    } else {
      setErrorMsg(res.message || 'Lỗi khi cập nhật hồ sơ');
    }
  }

  function handleLogout() {
    onUserChange(null);
    setTab('login');
    onNotify('success', 'Đã đăng xuất khỏi tài khoản.');
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-[#121212] border border-white/15 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between bg-[#181818]/70">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-[#D4AF37]/15 border border-[#D4AF37]/40 flex items-center justify-center text-[#D4AF37]">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                {t.accountTitle}
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40 rounded-full font-semibold">
                  {currentUser ? t.loggedInBadge : t.guestBadge}
                </span>
              </h3>
              <p className="text-xs text-zinc-400">
                {currentUser ? currentUser.email : 'Lưu trữ tiến độ, lộ trình và phân tích cá nhân hóa an toàn'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-2 rounded-xl hover:bg-white/5 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/10 bg-[#161616] p-1.5 gap-1.5">
          {currentUser ? (
            <>
              <button
                onClick={() => setTab('profile')}
                className={`flex-1 py-2 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
                  tab === 'profile' ? 'bg-[#D4AF37] text-black shadow-md' : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <User className="h-3.5 w-3.5" />
                {t.tabProfile}
              </button>
              <button
                onClick={() => setTab('register')}
                className={`flex-1 py-2 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
                  tab === 'register' ? 'bg-[#D4AF37] text-black shadow-md' : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <UserPlus className="h-3.5 w-3.5" />
                {t.tabRegister}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => { setTab('login'); setErrorMsg(''); }}
                className={`flex-1 py-2 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
                  tab === 'login' ? 'bg-[#D4AF37] text-black shadow-md' : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <LogIn className="h-3.5 w-3.5" />
                {t.tabLogin}
              </button>
              <button
                onClick={() => { setTab('register'); setErrorMsg(''); }}
                className={`flex-1 py-2 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
                  tab === 'register' ? 'bg-[#D4AF37] text-black shadow-md' : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <UserPlus className="h-3.5 w-3.5" />
                {t.tabRegister}
              </button>
            </>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          
          {errorMsg && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-3.5 text-rose-300 text-xs flex items-center gap-3">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* TAB 1: USER PROFILE & CLOUD DATA SYNC */}
          {tab === 'profile' && currentUser && (
            <div className="space-y-6">
              
              {/* Learner Card */}
              <div className="bg-gradient-to-br from-[#1d1a12] to-[#161616] border border-[#D4AF37]/30 rounded-2xl p-5 relative overflow-hidden">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-[#D4AF37] text-black font-extrabold text-xl flex items-center justify-center shadow-lg uppercase">
                      {currentUser.name ? currentUser.name.charAt(0) : currentUser.email.charAt(0)}
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-white">{currentUser.name || 'Học viên'}</h4>
                      <p className="text-xs text-zinc-400 font-mono">{currentUser.email}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-[10px] font-semibold bg-[#D4AF37]/20 text-[#D4AF37] px-2 py-0.5 rounded-md border border-[#D4AF37]/30">
                          {currentUser.targetLanguage || 'English'}
                        </span>
                        <span className="text-[10px] font-semibold bg-white/10 text-zinc-300 px-2 py-0.5 rounded-md">
                          {currentUser.level || 'Intermediate'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleLogout}
                    className="text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    {t.btnLogout}
                  </button>
                </div>

                {/* Account Stats Strip */}
                <div className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-white/10 text-center">
                  <div className="bg-black/40 rounded-xl p-2 border border-white/5">
                    <span className="text-[10px] text-zinc-400 block">Lộ trình & Mục tiêu</span>
                    <span className="text-sm font-bold text-[#D4AF37]">
                      {currentState.roadmap?.weeks?.length || 1} Tuần
                    </span>
                  </div>
                  <div className="bg-black/40 rounded-xl p-2 border border-white/5">
                    <span className="text-[10px] text-zinc-400 block">Nhật ký phản tư</span>
                    <span className="text-sm font-bold text-emerald-400">
                      {currentState.reflections?.length || 0} Bài
                    </span>
                  </div>
                  <div className="bg-black/40 rounded-xl p-2 border border-white/5">
                    <span className="text-[10px] text-zinc-400 block">Phiên học tập</span>
                    <span className="text-sm font-bold text-sky-400">
                      {currentState.studyLogs?.length || 0} Lần
                    </span>
                  </div>
                </div>
              </div>

              {/* Admin Console Shortcut for Admin Accounts */}
              {(currentUser.role === 'admin' || currentUser.email === 'minhquankt298@gmail.com') && (
                <div className="bg-gradient-to-r from-[#211a08] via-[#1a1608] to-[#121212] border border-[#D4AF37]/60 rounded-2xl p-4 shadow-lg flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-[#D4AF37] text-black font-bold flex items-center justify-center shrink-0">
                      <ShieldCheck className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">Quyền Quản Trị Viên (Admin)</span>
                        <span className="bg-[#D4AF37]/30 text-[#D4AF37] text-[10px] font-mono font-bold px-1.5 py-0.2 rounded">
                          ACTIVE
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        Quản lý toàn bộ danh sách học viên, tiến độ và xuất file nghiên cứu.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      onClose();
                      if (onOpenAdminConsole) onOpenAdminConsole();
                    }}
                    className="bg-[#D4AF37] hover:bg-[#c4a030] active:scale-95 text-black text-xs font-bold px-3.5 py-2 rounded-xl transition cursor-pointer shrink-0 shadow-md flex items-center gap-1.5"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>Mở Bảng Quản Trị</span>
                  </button>
                </div>
              )}

              {/* Cloud Sync & Action Panel */}
              <div className="bg-[#181818] border border-white/10 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                    <Cloud className="h-4 w-4 text-[#D4AF37]" />
                    <span>{t.cloudSyncLabel}</span>
                  </div>
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3" />
                    {t.autoSaveEnabled}
                  </span>
                </div>
                
                <p className="text-xs text-zinc-400">
                  Dữ liệu được lưu trữ tự động trên đám mây theo tài khoản của bạn, cho phép bạn truy cập từ bất kỳ thiết bị nào.
                </p>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={handleSaveData}
                    disabled={loading}
                    className="bg-[#242424] hover:bg-[#2e2e2e] border border-white/10 hover:border-[#D4AF37]/40 text-white text-xs font-semibold py-2.5 px-3 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Cloud className="h-4 w-4 text-[#D4AF37]" />
                    <span>{loading ? 'Đang lưu...' : t.btnSaveData}</span>
                  </button>
                  <button
                    onClick={handleLoadData}
                    disabled={loading}
                    className="bg-[#242424] hover:bg-[#2e2e2e] border border-white/10 hover:border-[#D4AF37]/40 text-white text-xs font-semibold py-2.5 px-3 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className="h-4 w-4 text-emerald-400" />
                    <span>{loading ? 'Đang tải...' : t.btnLoadData}</span>
                  </button>
                </div>
              </div>

              {/* Edit Profile & Security Section */}
              <form onSubmit={handleUpdateProfile} className="bg-[#181818] border border-white/10 rounded-2xl p-5 space-y-4">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <User className="h-4 w-4 text-[#D4AF37]" />
                  <span>Cập nhật thông tin & Đổi mật khẩu</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-zinc-300 block mb-1.5">{t.nameLabel}</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder={t.namePlaceholder}
                      className="w-full bg-[#121212] border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-zinc-300 block mb-1.5">{t.targetLangLabel}</label>
                    <input
                      type="text"
                      value={editTargetLang}
                      onChange={(e) => setEditTargetLang(e.target.value)}
                      placeholder="Ngôn ngữ mục tiêu"
                      className="w-full bg-[#121212] border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-zinc-300 block mb-1.5">{t.levelLabel}</label>
                    <select
                      value={editLevel}
                      onChange={(e) => setEditLevel(e.target.value)}
                      className="w-full bg-[#121212] border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                    >
                      <option value="Beginner (A1-A2)">Sơ cấp (A1 - A2)</option>
                      <option value="Intermediate (B1-B2)">Trung cấp (B1 - B2)</option>
                      <option value="Advanced (C1-C2)">Nâng cao (C1 - C2)</option>
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-medium text-zinc-300">Đổi mật khẩu mới (tùy chọn)</label>
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="text-[11px] text-[#D4AF37] hover:text-[#f3cd57] flex items-center gap-1 transition cursor-pointer"
                      >
                        {showNewPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        <span>{showNewPassword ? 'Ẩn' : 'Hiện'}</span>
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Nhập mật khẩu mới nếu muốn đổi"
                        className="w-full bg-[#121212] border border-white/15 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#D4AF37]"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isSavingProfile}
                    className="bg-[#D4AF37] hover:bg-[#c4a030] active:scale-95 text-black font-bold text-xs px-4 py-2 rounded-xl transition cursor-pointer disabled:opacity-50"
                  >
                    {isSavingProfile ? 'Đang lưu...' : t.btnUpdateProfile}
                  </button>
                </div>
              </form>

            </div>
          )}

          {/* TAB 2: LOGIN */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="text-center pb-2">
                <h4 className="text-base font-bold text-white">Đăng nhập tài khoản</h4>
                <p className="text-xs text-zinc-400 mt-1">
                  Nhập email và mật khẩu của bạn để truy cập và đồng bộ quá trình học
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-300 block mb-1.5">{t.emailLabel}</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t.emailPlaceholder}
                    className="w-full bg-[#181818] border border-white/15 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-zinc-300">{t.passwordLabel}</label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[11px] text-[#D4AF37] hover:text-[#f3cd57] flex items-center gap-1 transition cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    <span>{showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}</span>
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t.passwordPlaceholder}
                    className="w-full bg-[#181818] border border-white/15 rounded-xl pl-9 pr-10 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#D4AF37]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-zinc-400 hover:text-white transition cursor-pointer"
                    title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#D4AF37] hover:bg-[#c4a030] active:scale-[0.99] text-black text-xs font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 cursor-pointer"
              >
                <LogIn className="h-4 w-4" />
                {loading ? 'Đang xác thực...' : t.btnLogin}
              </button>

              <div className="pt-3 text-center">
                <button
                  type="button"
                  onClick={() => { setTab('register'); setErrorMsg(''); }}
                  className="text-xs text-zinc-400 hover:text-[#D4AF37] transition cursor-pointer"
                >
                  Chưa có tài khoản? <span className="font-bold underline">Đăng ký tài khoản mới</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: REGISTER */}
          {tab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="text-center pb-2">
                <h4 className="text-base font-bold text-white">Tạo tài khoản mới</h4>
                <p className="text-xs text-zinc-400 mt-1">
                  Tự đặt mật khẩu bảo mật cho tài khoản của bạn
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-zinc-300 block mb-1.5">{t.emailLabel} *</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t.emailPlaceholder}
                      className="w-full bg-[#181818] border border-white/15 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-zinc-300 block mb-1.5">{t.nameLabel}</label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t.namePlaceholder}
                      className="w-full bg-[#181818] border border-white/15 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-zinc-300">{t.passwordLabel} (Tự đặt mật khẩu) *</label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[11px] text-[#D4AF37] hover:text-[#f3cd57] flex items-center gap-1 transition cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    <span>{showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}</span>
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Nhập mật khẩu tự chọn (tối thiểu 4 ký tự)"
                    className="w-full bg-[#181818] border border-white/15 rounded-xl pl-9 pr-10 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#D4AF37]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-zinc-400 hover:text-white transition cursor-pointer"
                    title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-zinc-300 block mb-1.5">{t.targetLangLabel}</label>
                  <input
                    type="text"
                    value={targetLanguage}
                    onChange={(e) => setTargetLanguage(e.target.value)}
                    placeholder="Ví dụ: IELTS 7.5, Tiếng Anh Giao Tiếp"
                    className="w-full bg-[#181818] border border-white/15 rounded-xl px-3 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-zinc-300 block mb-1.5">{t.levelLabel}</label>
                  <select
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                    className="w-full bg-[#181818] border border-white/15 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                  >
                    <option value="Beginner (A1-A2)">Sơ cấp (A1 - A2)</option>
                    <option value="Intermediate (B1-B2)">Trung cấp (B1 - B2)</option>
                    <option value="Advanced (C1-C2)">Nâng cao (C1 - C2)</option>
                  </select>
                </div>
              </div>

              <div className="bg-[#D4AF37]/10 border border-[#D4AF37]/20 rounded-xl p-3 text-[11px] text-[#D4AF37]">
                ✨ Khi đăng ký, toàn bộ dữ liệu lộ trình, mục tiêu và nhật ký hiện tại sẽ tự động được sao lưu vào tài khoản mới.
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#D4AF37] hover:bg-[#c4a030] active:scale-[0.99] text-black text-xs font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 cursor-pointer"
              >
                <UserPlus className="h-4 w-4" />
                {loading ? 'Đang tạo tài khoản...' : t.btnRegister}
              </button>

              <div className="pt-3 text-center">
                <button
                  type="button"
                  onClick={() => { setTab('login'); setErrorMsg(''); }}
                  className="text-xs text-zinc-400 hover:text-[#D4AF37] transition cursor-pointer"
                >
                  Đã có tài khoản? <span className="font-bold underline">Đăng nhập ngay</span>
                </button>
              </div>
            </form>
          )}

        </div>

      </div>
    </div>
  );
};
