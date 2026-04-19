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
    siteArchive: '🗄 Archive',

    // System panel
    sysTitle: 'System',
    sysDiskRam: 'Disk & RAM',
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

    // CI / Deployments panel
    ciTitle: 'CI / Deployments',
    ciNotConfigured: 'Set GITHUB_TOKEN and GITHUB_OWNER environment variables to enable this section.',
    ciNoRepos: 'No repositories configured. Mount a ci-repos.yaml file at /etc/admin-routine/ci-repos.yaml.',
    ciNoRuns: 'No workflow runs found.',
    ciWorkflow: 'Workflow · Branch',
    ciCommit: 'Commit',
    ciStatus: 'Status',
    ciDuration: 'Duration',
    ciTimestamp: 'Started',

    sysPruneBtn: 'Prune Images',
    sysPruneRunning: 'Pruning…',
    sysPruneResult: (count, size) => count > 0 ? `Removed ${count} image(s), reclaimed ${size}` : 'Nothing to remove.',
    sysPruneError: 'Prune failed: ',
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
    siteArchive: '🗄 Архив',

    // System panel
    sysTitle: 'Система',
    sysDiskRam: 'Диск и RAM',
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

    // CI / Deployments panel
    ciTitle: 'CI / Деплой',
    ciNotConfigured: 'Укажите переменные GITHUB_TOKEN и GITHUB_OWNER для включения этого раздела.',
    ciNoRepos: 'Репозитории не настроены. Смонтируйте файл ci-repos.yaml по пути /etc/admin-routine/ci-repos.yaml.',
    ciNoRuns: 'Запуски workflow не найдены.',
    ciWorkflow: 'Workflow · Ветка',
    ciCommit: 'Коммит',
    ciStatus: 'Статус',
    ciDuration: 'Длительность',
    ciTimestamp: 'Запущен',

    sysPruneBtn: 'Очистить образы',
    sysPruneRunning: 'Очистка…',
    sysPruneResult: (count, size) => count > 0 ? `Удалено ${count} образ(ов), освобождено ${size}` : 'Нечего удалять.',
    sysPruneError: 'Ошибка очистки: ',
  },
}

export const SITE_LABEL_KEYS = {
  'family-kitchen-recipes': 'siteRecipes',
  'poetry-site': 'sitePoetry',
  'news-site': 'siteNews',
  'budget-site': 'siteBudget',
  'reminders-app': 'siteReminders',
  'family-archive': 'siteArchive',
}

export function useT() {
  const lang = useLangStore((s) => s.lang)
  return (key, ...args) => {
    const val = translations[lang]?.[key] ?? translations.en[key] ?? key
    return typeof val === 'function' ? val(...args) : val
  }
}
