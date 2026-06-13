import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Language = 'en' | 'ar';

interface Translations {
  [key: string]: { en: string; ar: string };
}

export const translations: Translations = {
  appName: { en: 'MatchHub', ar: 'MatchHub' },
  home: { en: 'Home', ar: 'الرئيسية' },
  party: { en: 'Party', ar: 'مباراة' },
  history: { en: 'History', ar: 'السجل' },
  rankings: { en: 'Rankings', ar: 'التصنيفات' },
  profile: { en: 'Profile', ar: 'الملف الشخصي' },
  admin: { en: 'Admin', ar: 'المدير' },
  login: { en: 'Login', ar: 'تسجيل الدخول' },
  register: { en: 'Register', ar: 'إنشاء حساب' },
  logout: { en: 'Logout', ar: 'تسجيل الخروج' },
  username: { en: 'Username', ar: 'اسم المستخدم' },
  password: { en: 'Password', ar: 'كلمة المرور' },
  displayName: { en: 'Display Name', ar: 'الاسم المعروض' },
  recentMatches: { en: 'Recent Matches', ar: 'المباريات الأخيرة' },
  topPlayers: { en: 'Top Players', ar: 'أفضل اللاعبين' },
  stats: { en: 'Stats', ar: 'إحصائيات' },
  totalMatches: { en: 'Total Matches', ar: 'إجمالي المباريات' },
  totalUsers: { en: 'Total Users', ar: 'إجمالي المستخدمين' },
  totalParties: { en: 'Total Parties', ar: 'إجمالي الجلسات' },
  fifa: { en: 'FIFA', ar: 'FIFA' },
  pes: { en: 'PES', ar: 'PES' },
  overall: { en: 'Overall', ar: 'الكل' },
  points: { en: 'Points', ar: 'النقاط' },
  matches: { en: 'Matches', ar: 'المباريات' },
  wins: { en: 'W', ar: 'ف' },
  losses: { en: 'L', ar: 'خ' },
  goalsFor: { en: 'GF', ar: 'أ.ل' },
  goalsAgainst: { en: 'GA', ar: 'أ.ع' },
  goalDifference: { en: 'GD', ar: 'ف.أ' },
  winRate: { en: 'Win %', ar: 'نسبة الفوز' },
  teamA: { en: 'Team A', ar: 'الفريق أ' },
  teamB: { en: 'Team B', ar: 'الفريق ب' },
  score: { en: 'Score', ar: 'النتيجة' },
  winner: { en: 'Winner', ar: 'الفائز' },
  winType: { en: 'Win Type', ar: 'نوع الفوز' },
  normal: { en: 'Normal', ar: 'عادي' },
  penalties: { en: 'Penalties', ar: 'ركلات ترجيح' },
  golden_goal: { en: 'Golden Goal', ar: 'هدف ذهبي' },
  submitResult: { en: 'Submit Result', ar: 'إرسال النتيجة' },
  createParty: { en: 'Create Party', ar: 'إنشاء جلسة' },
  step1: { en: 'Select Members', ar: 'اختر الأعضاء' },
  step2: { en: 'Select Game', ar: 'اختر اللعبة' },
  step3: { en: 'Select Format', ar: 'اختر النمط' },
  step4: { en: 'Arrange Teams', ar: 'ترتيب الفرق' },
  step5: { en: 'Confirm', ar: 'تأكيد' },
  spectators: { en: 'Spectators', ar: 'المشاهدين' },
  startMatch: { en: 'Start Match', ar: 'بدء المباراة' },
  back: { en: 'Back', ar: 'رجوع' },
  next: { en: 'Next', ar: 'التالي' },
  save: { en: 'Save', ar: 'حفظ' },
  cancel: { en: 'Cancel', ar: 'إلغاء' },
  confirm: { en: 'Confirm', ar: 'تأكيد' },
  delete: { en: 'Delete', ar: 'حذف' },
  promoteAdmin: { en: 'Promote to Admin', ar: 'ترقية لمدير' },
  searchUsers: { en: 'Search Users', ar: 'البحث عن مستخدمين' },
  noMatches: { en: 'No matches found', ar: 'لا توجد مباريات' },
  noUsers: { en: 'No users found', ar: 'لا يوجد مستخدمين' },
  emptyState: { en: 'Nothing to see here yet!', ar: 'لا يوجد شيء لعرضه هنا بعد!' },

  // Party codes & joining
  partyCode: { en: 'Party Code', ar: 'كود البارتي' },
  yourPartyCode: { en: 'Your party code', ar: 'كود البارتي بتاعك' },
  shareCodeHint: { en: 'Share this code so others can join', ar: 'شارك الكود ده عشان الناس تنضم' },
  share: { en: 'Share', ar: 'مشاركة' },
  copy: { en: 'Copy', ar: 'نسخ' },
  copied: { en: 'Copied!', ar: 'تم النسخ!' },
  done: { en: 'Done', ar: 'تم' },
  searchPlayers: { en: 'Search players', ar: 'بحث عن لاعب' },
  searchParty: { en: 'Search party', ar: 'بحث عن بارتي' },
  enterPartyCode: { en: 'Enter party code', ar: 'أدخل كود البارتي' },
  join: { en: 'Join', ar: 'انضمام' },
  joinParty: { en: 'Join Party', ar: 'انضمام للبارتي' },
  partyNotFound: { en: 'Party not found', ar: 'البارتي غير موجودة' },
  joined: { en: 'Joined the party!', ar: 'تم الانضمام للبارتي!' },
  members: { en: 'Members', ar: 'الأعضاء' },
  status: { en: 'Status', ar: 'الحالة' },
  party_pending: { en: 'Pending', ar: 'في الانتظار' },
  party_in_progress: { en: 'In Progress', ar: 'جارية' },
  party_completed: { en: 'Completed', ar: 'منتهية' },
  matchesInParty: { en: 'Matches', ar: 'المباريات' },
  newMatch: { en: 'New Match', ar: 'ماتش جديد' },
  rematch: { en: 'Rematch (same opponents)', ar: 'ماتش تاني بنفس الخصوم' },
  startLater: { en: 'You can start a match later from the party page', ar: 'تقدر تبدأ ماتش بعدين من صفحة البارتي' },
  needMoreMembers: { en: 'You need at least one more player to start a match', ar: 'محتاج لاعب تاني على الأقل عشان تبدأ ماتش' },
  closeParty: { en: 'Close Party', ar: 'إغلاق البارتي' },
  partyClosed: { en: 'Party closed', ar: 'تم إغلاق البارتي' },
  pendingInvites: { en: 'Pending', ar: 'في انتظار القبول' },

  // Invitations (floating)
  invitedYou: { en: 'invited you to a party', ar: 'دعاك لبارتي' },
  accept: { en: 'Accept', ar: 'قبول' },
  reject: { en: 'Reject', ar: 'رفض' },
  doNotDisturb: { en: 'Do not disturb', ar: 'عدم الإزعاج' },
  invitationAccepted: { en: 'Invitation accepted', ar: 'تم قبول الدعوة' },
  createPartyAction: { en: 'Create Party', ar: 'إنشاء البارتي' },
  noFriendsYet: { en: 'No mutual follows yet. Use search to find players.', ar: 'لسه مفيش متابعة متبادلة. استخدم البحث للقاء لاعبين.' },

  // Follow
  follow: { en: 'Follow', ar: 'متابعة' },
  unfollow: { en: 'Unfollow', ar: 'إلغاء المتابعة' },
  followers: { en: 'Followers', ar: 'المتابِعون' },
  following: { en: 'Following', ar: 'يتابع' },
  noFollowers: { en: 'No followers yet', ar: 'لا يوجد متابِعون بعد' },
  noFollowing: { en: 'Not following anyone yet', ar: 'لا يتابع أحدًا بعد' },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    const saved = localStorage.getItem('matchhub-lang') as Language;
    if (saved === 'en' || saved === 'ar') {
      setLanguageState(saved);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('matchhub-lang', lang);
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  };

  useEffect(() => {
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  const t = (key: string) => {
    if (!translations[key]) return key;
    return translations[key][language];
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
