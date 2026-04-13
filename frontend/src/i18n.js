import { useLangStore } from './store/langStore'

const translations = {
  en: {
    appName: 'Admin Routine',

    // Login page
    backupManagement: 'Backup management',
    username: 'Username',
    password: 'Password',
    signingIn: 'Signing in…',
    signIn: 'Sign in',
    invalidCredentials: 'Invalid credentials',

    // Header
    signOut: 'Sign out',

    // Jobs
    queued: 'Queued…',
    running: 'Running…',

    // Sites section
    sites: 'Sites',
    volumes: 'Volumes:',
    dbOnly: 'DB only',
    lastBackup: 'Last backup:',
    createBackup: '+ Create Backup',

    // Backups section
    backups: 'Backups',
    filter: 'Filter:',
    allSites: 'All sites',
    colFilename: 'Filename',
    colSite: 'Site',
    colSize: 'Size',
    colCreated: 'Created',
    colActions: 'Actions',
    download: '↓ Download',
    restore: '↺ Restore',
    delete: '🗑 Delete',
    noBackups: 'No backups yet. Create one above.',

    // Confirm dialogs
    confirmRestore: (f) =>
      `Restore from "${f}"?\nThis will OVERWRITE the current database and files.`,
    confirmDelete: (f) => `Delete backup "${f}"?`,

    // Alert messages
    failedBackup: 'Failed to start backup: ',
    failedRestore: 'Failed to start restore: ',
    failedDelete: 'Failed to delete: ',

    // Site labels
    siteRecipes: '🍳 Recipes',
    sitePoetry: '📝 Poetry',
    siteNews: '📰 News',
    siteBudget: '💰 Budget',
    siteReminders: '🔔 Reminders',

    // System panel
    sysTitle: 'System',
    sysDisk: '💾 Disk',
    sysRam: '🧠 RAM',
    sysVolumes: 'Docker Volumes',
    sysContainers: 'Containers',
    sysContainerName: 'Name',
    sysContainerStatus: 'Status',
    sysContainerRss: 'Memory (RSS)',
    sysContainerLimit: 'Limit',
    sysContainerPct: 'Usage',
    sysNoData: 'No volume data available.',
    sysNoDocker: 'Docker socket not available (check container mount).',
  },

  ru: {
    appName: 'Admin Routine',

    // Login page
    backupManagement: 'Управление бэкапами',
    username: 'Имя пользователя',
    password: 'Пароль',
    signingIn: 'Вход…',
    signIn: 'Войти',
    invalidCredentials: 'Неверные учётные данные',

    // Header
    signOut: 'Выйти',

    // Jobs
    queued: 'В очереди…',
    running: 'Выполняется…',

    // Sites section
    sites: 'Сайты',
    volumes: 'Тома:',
    dbOnly: 'Только БД',
    lastBackup: 'Последний бэкап:',
    createBackup: '+ Создать бэкап',

    // Backups section
    backups: 'Бэкапы',
    filter: 'Фильтр:',
    allSites: 'Все сайты',
    colFilename: 'Файл',
    colSite: 'Сайт',
    colSize: 'Размер',
    colCreated: 'Создан',
    colActions: 'Действия',
    download: '↓ Скачать',
    restore: '↺ Восстановить',
    delete: '🗑 Удалить',
    noBackups: 'Бэкапов нет. Создайте выше.',

    // Confirm dialogs
    confirmRestore: (f) =>
      `Восстановить из "${f}"?\nБД и файлы будут ПЕРЕЗАПИСАНЫ.`,
    confirmDelete: (f) => `Удалить бэкап "${f}"?`,

    // Alert messages
    failedBackup: 'Ошибка запуска бэкапа: ',
    failedRestore: 'Ошибка запуска восстановления: ',
    failedDelete: 'Ошибка удаления: ',

    // Site labels
    siteRecipes: '🍳 Рецепты',
    sitePoetry: '📝 Поэзия',
    siteNews: '📰 Новости',
    siteBudget: '💰 Бюджет',
    siteReminders: '🔔 Напоминания',

    // System panel
    sysTitle: 'Система',
    sysDisk: '💾 Диск',
    sysRam: '🧠 Память',
    sysVolumes: 'Docker Volumes',
    sysContainers: 'Контейнеры',
    sysContainerName: 'Имя',
    sysContainerStatus: 'Статус',
    sysContainerRss: 'Память (RSS)',
    sysContainerLimit: 'Лимит',
    sysContainerPct: 'Использование',
    sysNoData: 'Данные о volumes недоступны.',
    sysNoDocker: 'Docker socket недоступен (проверьте монтирование контейнера).',
  },
}

export const SITE_LABEL_KEYS = {
  'family-kitchen-recipes': 'siteRecipes',
  'poetry-site': 'sitePoetry',
  'news-site': 'siteNews',
  'budget-site': 'siteBudget',
  'reminders-app': 'siteReminders',
}

export function useT() {
  const lang = useLangStore((s) => s.lang)
  return (key, ...args) => {
    const val = translations[lang]?.[key] ?? translations.en[key] ?? key
    return typeof val === 'function' ? val(...args) : val
  }
}
