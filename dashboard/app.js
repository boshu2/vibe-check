// Vibe-Check Dashboard Application
class VibeDashboard {
  constructor() {
    this.profile = null;
    this.charts = {};
    this.currentPage = 'dashboard';
    this.historyFilters = {
      rating: 'all',
      sortBy: 'date-desc',
      range: 'all'
    };
  }

  async init() {
    this.setupEventListeners();
    await this.loadProfile();
    this.renderDashboard();
    this.initCharts();
  }

  setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const page = e.currentTarget.dataset.page;
        this.navigateTo(page);
      });
    });

    // Sidebar toggle
    const sidebarToggle = document.getElementById('sidebarToggle');
    if (sidebarToggle) {
      sidebarToggle.addEventListener('click', () => this.toggleSidebar());
    }

    // Refresh button
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.refresh());
    }

    // Chart range buttons
    document.querySelectorAll('.chart-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const range = parseInt(e.target.dataset.range);
        this.updateTrendChart(range);
        document.querySelectorAll('.chart-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
      });
    });

    // Achievement modal close
    const closeModal = document.getElementById('closeAchievementModal');
    if (closeModal) {
      closeModal.addEventListener('click', () => this.closeModal());
    }

    // Session modal close
    const closeSessionModal = document.getElementById('closeSessionModal');
    if (closeSessionModal) {
      closeSessionModal.addEventListener('click', () => this.closeSessionModal());
    }

    // History filters
    ['filterRating', 'sortBy', 'filterRange'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', (e) => {
          const key = id === 'filterRating' ? 'rating' :
                      id === 'sortBy' ? 'sortBy' : 'range';
          this.historyFilters[key] = e.target.value;
          this.renderHistory();
        });
      }
    });

    // View All link
    const viewAllLink = document.querySelector('.view-all');
    if (viewAllLink) {
      viewAllLink.addEventListener('click', (e) => {
        e.preventDefault();
        this.navigateTo('history');
      });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeModal();
        this.closeSessionModal();
      }
    });

    // Click outside modal to close
    document.getElementById('sessionModal')?.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-overlay')) {
        this.closeSessionModal();
      }
    });

    // Metrics help buttons
    document.getElementById('codeHealthHelp')?.addEventListener('click', () => {
      this.showMetricsHelp('codeHealth');
    });
    document.getElementById('patternScoreHelp')?.addEventListener('click', () => {
      this.showMetricsHelp('patternScore');
    });

    // Metrics modal close
    document.getElementById('closeMetricsModal')?.addEventListener('click', () => {
      this.closeMetricsModal();
    });
    document.getElementById('metricsModal')?.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-overlay')) {
        this.closeMetricsModal();
      }
    });
  }

  async loadProfile() {
    // First check for global variable (works with file:// URLs)
    if (window.VIBE_CHECK_DATA) {
      this.dashboardData = window.VIBE_CHECK_DATA;
      this.profile = this.transformToProfile(window.VIBE_CHECK_DATA);
      return;
    }

    // Try to fetch dashboard-data.json (works with http:// URLs)
    try {
      const response = await fetch('dashboard-data.json');
      if (response.ok) {
        const data = await response.json();
        this.dashboardData = data;
        this.profile = this.transformToProfile(data);
        return;
      }
    } catch (e) {
      console.log('No dashboard-data.json found, using mock data');
    }

    // Fall back to localStorage or mock
    const stored = localStorage.getItem('vibe-check-profile');
    if (stored) {
      this.profile = JSON.parse(stored);
    } else {
      this.profile = this.getEmptyProfile();
    }
  }

  transformToProfile(data) {
    // Transform DashboardData to legacy profile format for existing UI
    return {
      version: data.version,
      xp: {
        total: data.profile.xp.total,
        level: data.profile.level,
        levelName: data.profile.levelName,
        currentLevelXP: data.profile.xp.current,
        nextLevelXP: data.profile.xp.next,
      },
      streak: data.profile.streak,
      achievements: data.achievements.filter(a => a.unlockedAt),
      // Map 'rating' to 'overall' for UI compatibility
      sessions: data.sessions.map(s => ({
        ...s,
        overall: s.rating || s.overall,
      })),
      stats: {
        totalSessions: data.stats.totals.sessions,
        totalCommitsAnalyzed: data.stats.totals.commits,
        avgVibeScore: data.stats.averages.allTime,
        bestVibeScore: Math.max(...data.sessions.map(s => s.vibeScore), 0),
        spiralsAvoided: data.sessions.filter(s => s.spirals === 0).length,
      },
    };
  }

  getEmptyProfile() {
    // Empty profile for new users - no fake data
    return {
      version: '1.0.0',
      xp: {
        total: 0,
        level: 1,
        levelName: 'Novice',
        currentLevelXP: 0,
        nextLevelXP: 100,
      },
      streak: {
        current: 0,
        longest: 0,
        weeklyProgress: 0,
        weeklyGoal: 5,
      },
      achievements: [],
      sessions: [],
      stats: {
        totalSessions: 0,
        totalCommitsAnalyzed: 0,
        avgVibeScore: 0,
        bestVibeScore: 0,
        spiralsAvoided: 0,
      },
    };
  }

  navigateTo(page) {
    this.currentPage = page;

    // Update nav
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === page);
    });

    // Update pages
    document.querySelectorAll('.page').forEach(p => {
      p.classList.toggle('active', p.id === `page-${page}`);
    });

    // Render page-specific content
    switch (page) {
      case 'achievements':
        this.renderAchievements();
        break;
      case 'history':
        this.renderHistory();
        break;
      case 'profile':
        this.renderProfile();
        break;
    }
  }

  renderDashboard() {
    this.updateRepoName();
    this.updateProfileSummary();
    this.updateStats();
    this.renderRecentSessions();
    this.renderInsights();
  }

  updateRepoName() {
    const repoEl = document.querySelector('#repoName .repo-path');
    if (!repoEl) return;

    if (this.dashboardData?.repo) {
      // Show just the repo name, not full path
      const parts = this.dashboardData.repo.split('/');
      const repoName = parts[parts.length - 1] || this.dashboardData.repo;
      repoEl.textContent = repoName;
      repoEl.title = this.dashboardData.repo; // Full path on hover
    } else {
      repoEl.textContent = 'No repo data';
    }
  }

  updateProfileSummary() {
    const { xp, streak } = this.profile;

    // Level info
    document.getElementById('levelIcon').textContent = this.getLevelIcon(xp.level);
    document.getElementById('levelName').textContent = `Level ${xp.level} ${xp.levelName}`;
    document.getElementById('xpText').textContent = `${xp.currentLevelXP}/${xp.nextLevelXP} XP`;

    const progress = (xp.currentLevelXP / xp.nextLevelXP) * 100;
    document.getElementById('xpFill').style.width = `${progress}%`;

    // Streak
    document.getElementById('streakText').textContent = `${streak.current} day streak`;
    document.getElementById('streakDays').textContent = streak.current;
  }

  updateStats() {
    const { sessions, stats } = this.profile;
    const latest = sessions[0];

    // Pattern Score (vibeScore)
    document.getElementById('currentScore').textContent = latest ? `${latest.vibeScore}%` : '--';
    document.getElementById('achievementCount').textContent =
      `${this.profile.achievements.length}/24`;

    // Code Health Rating (metric-based quality grade)
    const codeHealthEl = document.getElementById('codeHealthRating');
    if (codeHealthEl && latest?.rating) {
      codeHealthEl.textContent = latest.rating;
      codeHealthEl.className = 'stat-value rating-badge rating-' + latest.rating.toLowerCase();
    }
  }

  renderRecentSessions() {
    const container = document.getElementById('recentSessions');
    const sessions = this.profile.sessions.slice(0, 5);

    if (sessions.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">📭</span>
          <p>No sessions yet. Run <code>vibe-check --score</code> to start!</p>
        </div>
      `;
      return;
    }

    container.innerHTML = sessions.map((session, idx) => {
      const rating = this.scoreToRating(session.vibeScore);
      return `
      <div class="session-item" data-session-idx="${idx}">
        <div>
          <div class="session-date">${this.formatDate(session.date)}</div>
          <div class="session-commits">${session.commits} commits · ${session.spirals} spirals</div>
        </div>
        <div class="session-score">${session.vibeScore}%</div>
        <span class="session-rating ${rating.toLowerCase()}">${rating}</span>
      </div>
    `}).join('');

    // Add click handlers
    container.querySelectorAll('.session-item').forEach(item => {
      item.addEventListener('click', () => {
        const idx = parseInt(item.dataset.sessionIdx);
        this.showSessionDetail(this.profile.sessions[idx]);
      });
    });
  }

  renderInsights() {
    const container = document.getElementById('insightsList');
    if (!container) return;

    if (!this.dashboardData?.insights?.length) {
      container.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">💡</span>
          <p>Run <code>vibe-check dashboard</code> to generate insights</p>
        </div>
      `;
      return;
    }

    const insights = this.dashboardData.insights.slice(0, 5);
    container.innerHTML = insights.map(insight => {
      const severityClass = {
        success: 'insight-success',
        warning: 'insight-warning',
        critical: 'insight-critical',
        info: 'insight-info',
      }[insight.severity] || 'insight-info';

      return `
        <div class="insight-item ${severityClass}">
          <span class="insight-icon">${insight.icon}</span>
          <div class="insight-content">
            <div class="insight-title">${insight.title}</div>
            <div class="insight-message">${insight.message}</div>
            ${insight.action ? `<div class="insight-action">${insight.action}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  initCharts() {
    // Check if Chart.js is loaded
    if (typeof Chart === 'undefined') {
      console.error('Chart.js not loaded');
      return;
    }

    console.log('Initializing charts with sessions:', this.profile?.sessions?.length);

    try {
      this.initTrendChart();
      this.initRadarChart();
      this.initRatingsChart();
      console.log('All charts initialized successfully');
    } catch (e) {
      console.error('Error initializing charts:', e);
    }
  }

  initTrendChart() {
    const canvas = document.getElementById('trendCanvas');
    if (!canvas) {
      console.error('trendCanvas element not found');
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Could not get 2D context for trendCanvas');
      return;
    }

    const sessions = this.profile.sessions || [];
    console.log('Trend chart sessions:', sessions.length, sessions.slice(0, 2));
    if (sessions.length === 0) {
      console.log('No sessions data for trend chart');
      return;
    }

    const reversed = sessions.slice().reverse();
    const labels = reversed.map(s => this.formatDate(s.date));
    const scores = reversed.map(s => s.vibeScore);
    console.log('Trend chart data - labels:', labels.length, 'scores:', scores.slice(0, 5));

    this.charts.trend = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Vibe Score',
          data: scores,
          borderColor: '#58a6ff',
          backgroundColor: 'rgba(88, 166, 255, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        scales: {
          y: {
            min: 0,
            max: 100,
            grid: { color: '#30363d' },
            ticks: { color: '#7d8590' },
          },
          x: {
            grid: { display: false },
            ticks: { color: '#7d8590' },
          }
        }
      }
    });
  }

  initRadarChart() {
    const canvas = document.getElementById('radarCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Use real metrics from dashboard data, or show defaults
    const metrics = this.dashboardData?.charts?.avgMetrics;

    // Only show real data - no fake placeholder values
    if (!metrics) {
      // Show empty state message instead of fake data
      const container = canvas.parentElement;
      container.innerHTML = `
        <div class="empty-chart-state">
          <span class="empty-icon">📊</span>
          <p>Run <code>vibe-check --score</code> to see your metrics</p>
        </div>
      `;
      return;
    }

    const data = [
      Math.min(100, metrics.trustPassRate),
      Math.min(100, metrics.iterationVelocity * 10), // scale velocity (commits/hr) to 0-100
      Math.min(100, metrics.flowEfficiency),
      Math.max(0, 100 - metrics.reworkRatio), // invert: lower rework = higher stability
      Math.max(0, 100 - metrics.debugSpiralDuration * 2), // scale spirals: 0 = 100, 50min = 0
    ];

    this.charts.radar = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: ['Trust Pass', 'Velocity', 'Flow', 'Stability', 'No Spirals'],
        datasets: [{
          label: 'Average (Last 10)',
          data: data,
          borderColor: '#58a6ff',
          backgroundColor: 'rgba(88, 166, 255, 0.2)',
          pointBackgroundColor: '#58a6ff',
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        scales: {
          r: {
            min: 0,
            max: 100,
            grid: { color: '#30363d' },
            angleLines: { color: '#30363d' },
            pointLabels: { color: '#7d8590' },
            ticks: { display: false },
          }
        }
      }
    });
  }

  initRatingsChart() {
    const canvas = document.getElementById('ratingsCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Count ratings
    const counts = { ELITE: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    this.profile.sessions.forEach(s => counts[s.overall]++);

    this.charts.ratings = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Elite', 'High', 'Medium', 'Low'],
        datasets: [{
          data: [counts.ELITE, counts.HIGH, counts.MEDIUM, counts.LOW],
          backgroundColor: ['#a371f7', '#3fb950', '#d29922', '#f85149'],
          borderWidth: 0,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#7d8590' },
          },
        },
      }
    });
  }

  updateTrendChart(days) {
    const sessions = this.profile.sessions.slice(0, days).reverse();
    const labels = sessions.map(s => this.formatDate(s.date));
    const data = sessions.map(s => s.vibeScore);

    this.charts.trend.data.labels = labels;
    this.charts.trend.data.datasets[0].data = data;
    this.charts.trend.update();
  }

  renderAchievements() {
    const container = document.getElementById('achievementsGrid');
    const unlocked = new Set(this.profile.achievements.map(a => a.id));

    // All possible achievements
    const allAchievements = [
      { id: 'first_check', name: 'First Blood', icon: '🩸', description: 'Run your first vibe-check' },
      { id: 'week_warrior', name: 'Week Warrior', icon: '⚔️', description: 'Maintain a 7-day streak' },
      { id: 'fortnight_force', name: 'Fortnight Force', icon: '🛡️', description: 'Maintain a 14-day streak' },
      { id: 'monthly_master', name: 'Monthly Master', icon: '👑', description: 'Maintain a 30-day streak' },
      { id: 'elite_vibes', name: 'Elite Vibes', icon: '✨', description: 'Achieve ELITE rating' },
      { id: 'consistent_high', name: 'High Roller', icon: '🎰', description: '5 consecutive HIGH+ sessions' },
      { id: 'perfect_week', name: 'Perfect Week', icon: '💎', description: '7 consecutive ELITE sessions' },
      { id: 'score_90', name: 'Ninety Club', icon: '🏅', description: 'Vibe Score ≥ 90%' },
      { id: 'ten_sessions', name: 'Getting Started', icon: '📊', description: '10 vibe-check sessions' },
      { id: 'fifty_sessions', name: 'Regular', icon: '📈', description: '50 vibe-check sessions' },
      { id: 'hundred_sessions', name: 'Centurion', icon: '💯', description: '100 vibe-check sessions' },
      { id: 'zen_master', name: 'Zen Master', icon: '🧘', description: '0 spirals in 50+ commit session' },
      { id: 'trust_builder', name: 'Trust Builder', icon: '🏗️', description: '10 sessions with 90%+ trust' },
      { id: 'comeback_kid', name: 'Comeback Kid', icon: '🔄', description: 'LOW → ELITE in 7 days' },
      { id: 'early_bird', name: 'Early Bird', icon: '🌅', description: 'Session before 7 AM' },
      { id: 'night_owl', name: 'Night Owl', icon: '🦉', description: 'Session after midnight' },
      { id: 'thousand_commits', name: 'Thousand Strong', icon: '🎯', description: '1000 commits analyzed' },
      // Hidden achievements shown as ???
      { id: 'perfect_score', name: '???', icon: '❓', description: '???', hidden: true },
      { id: 'spiral_survivor', name: '???', icon: '❓', description: '???', hidden: true },
    ];

    container.innerHTML = allAchievements.map(achievement => {
      const isUnlocked = unlocked.has(achievement.id);
      const unlockedAchievement = this.profile.achievements.find(a => a.id === achievement.id);

      return `
        <div class="achievement-card ${isUnlocked ? 'unlocked' : 'locked'}">
          <div class="achievement-icon-wrapper">
            ${isUnlocked || !achievement.hidden ? achievement.icon : '🔒'}
          </div>
          <div class="achievement-info">
            <h4>${isUnlocked || !achievement.hidden ? achievement.name : '???'}</h4>
            <p>${isUnlocked || !achievement.hidden ? achievement.description : 'Keep playing to unlock!'}</p>
            ${isUnlocked ? `<div class="achievement-date">Unlocked ${this.formatDate(unlockedAchievement.unlockedAt)}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');

    document.getElementById('achievementProgress').textContent =
      `${this.profile.achievements.length}/${allAchievements.length} unlocked`;
  }

  renderHistory() {
    const container = document.getElementById('historyContainer');
    let sessions = [...this.profile.sessions];

    // Apply filters
    const { rating, sortBy, range } = this.historyFilters;

    // Rating filter
    if (rating !== 'all') {
      const ratingOrder = ['ELITE', 'HIGH', 'MEDIUM', 'LOW'];
      const minIdx = ratingOrder.indexOf(rating);
      sessions = sessions.filter(s => ratingOrder.indexOf(s.overall) <= minIdx);
    }

    // Time range filter
    if (range !== 'all') {
      const daysAgo = parseInt(range);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - daysAgo);
      sessions = sessions.filter(s => new Date(s.date) >= cutoff);
    }

    // Sorting
    sessions.sort((a, b) => {
      switch (sortBy) {
        case 'date-asc': return new Date(a.date) - new Date(b.date);
        case 'date-desc': return new Date(b.date) - new Date(a.date);
        case 'score-desc': return b.vibeScore - a.vibeScore;
        case 'score-asc': return a.vibeScore - b.vibeScore;
        case 'commits-desc': return b.commits - a.commits;
        default: return 0;
      }
    });

    // Update stats
    const avgScore = sessions.length > 0
      ? Math.round(sessions.reduce((sum, s) => sum + s.vibeScore, 0) / sessions.length)
      : 0;
    document.getElementById('historyCount').textContent = `${sessions.length} sessions`;
    document.getElementById('historyAvg').textContent = `Avg: ${avgScore}%`;

    // Render heatmap
    this.renderHeatmap();

    // Render scope health chart
    this.renderScopeHealthChart();

    // Render session list
    container.innerHTML = `
      <div class="recent-section">
        <div class="section-header">
          <h3>All Sessions</h3>
        </div>
        <div class="sessions-list">
          ${sessions.length === 0 ? `
            <div class="empty-state">
              <span class="empty-icon">🔍</span>
              <p>No sessions match your filters</p>
            </div>
          ` : sessions.map((session, idx) => {
            const trend = this.getSessionTrend(session, idx, sessions);
            const rating = this.scoreToRating(session.vibeScore);
            return `
              <div class="session-item" data-session-idx="${this.profile.sessions.indexOf(session)}">
                <div>
                  <div class="session-date">${this.formatDateLong(session.date)}</div>
                  <div class="session-commits">${session.commits} commits · ${session.spirals} spirals · +${session.xpEarned || 0} XP</div>
                </div>
                ${trend}
                <div class="session-score">${session.vibeScore}%</div>
                <span class="session-rating ${rating.toLowerCase()}">${rating}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    // Add click handlers
    container.querySelectorAll('.session-item').forEach(item => {
      item.addEventListener('click', () => {
        const idx = parseInt(item.dataset.sessionIdx);
        this.showSessionDetail(this.profile.sessions[idx]);
      });
    });
  }

  getSessionTrend(session, idx, sessions) {
    if (idx >= sessions.length - 1) return '<span class="trend-indicator neutral">—</span>';
    const prev = sessions[idx + 1];
    const diff = session.vibeScore - prev.vibeScore;
    if (diff > 5) return `<span class="trend-indicator up">↑ +${diff}</span>`;
    if (diff < -5) return `<span class="trend-indicator down">↓ ${diff}</span>`;
    return '<span class="trend-indicator neutral">→</span>';
  }

  renderHeatmap() {
    const container = document.getElementById('heatmapContainer');
    if (!container || !this.dashboardData?.charts?.hourlyActivity) return;

    const activity = this.dashboardData.charts.hourlyActivity;
    const maxActivity = Math.max(...Object.values(activity), 1);
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    // Build hour headers (0-23 simplified to key hours)
    let hourLabels = '';
    for (let h = 0; h < 24; h += 3) {
      hourLabels += `<div class="heatmap-hour" style="grid-column: span 3">${h}:00</div>`;
    }

    // Build grid (simplified - just show hourly data as a single row)
    let cells = '';
    for (let h = 0; h < 24; h++) {
      const count = activity[h] || 0;
      const level = Math.ceil((count / maxActivity) * 5);
      cells += `<div class="heatmap-cell level-${level}" title="${count} commits at ${h}:00"></div>`;
    }

    container.innerHTML = `
      <div class="heatmap-grid" style="grid-template-columns: 50px repeat(24, 1fr);">
        <div class="heatmap-label">Hours</div>
        ${Array.from({length: 24}, (_, h) =>
          `<div class="heatmap-hour">${h}</div>`
        ).join('')}
        <div class="heatmap-label">Activity</div>
        ${cells}
      </div>
      <div class="heatmap-legend">
        <span>Less</span>
        ${[0,1,2,3,4,5].map(l => `<div class="heatmap-legend-cell level-${l}"></div>`).join('')}
        <span>More</span>
      </div>
    `;
  }

  renderScopeHealthChart() {
    const canvas = document.getElementById('scopeHealthCanvas');
    if (!canvas || !this.dashboardData?.charts?.scopeHealth) return;

    // Destroy existing chart
    if (this.charts.scopeHealth) {
      this.charts.scopeHealth.destroy();
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scopeData = this.dashboardData.charts.scopeHealth.slice(0, 8);
    const labels = scopeData.map(s => s.scope || '(none)');
    const commits = scopeData.map(s => s.commits);
    const fixRatios = scopeData.map(s => s.fixRatio);

    this.charts.scopeHealth = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Commits',
            data: commits,
            backgroundColor: '#58a6ff',
            borderRadius: 4,
          },
          {
            label: 'Fix Ratio %',
            data: fixRatios,
            backgroundColor: '#f85149',
            borderRadius: 4,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#7d8590' }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#7d8590' }
          },
          y: {
            grid: { color: '#30363d' },
            ticks: { color: '#7d8590' }
          }
        }
      }
    });
  }

  renderProfile() {
    const container = document.getElementById('profileContainer');
    const { stats, xp, streak } = this.profile;

    container.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">${this.getLevelIcon(xp.level)}</div>
          <div class="stat-content">
            <span class="stat-value">Level ${xp.level}</span>
            <span class="stat-label">${xp.levelName}</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">⭐</div>
          <div class="stat-content">
            <span class="stat-value">${xp.total}</span>
            <span class="stat-label">Total XP</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">🔥</div>
          <div class="stat-content">
            <span class="stat-value">${streak.longest}</span>
            <span class="stat-label">Longest Streak</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">🏆</div>
          <div class="stat-content">
            <span class="stat-value">${stats.bestVibeScore}%</span>
            <span class="stat-label">Best Score</span>
          </div>
        </div>
      </div>

      <div class="recent-section" style="margin-top: var(--spacing-xl)">
        <h3 style="margin-bottom: var(--spacing-lg)">Lifetime Stats</h3>
        <div class="sessions-list">
          <div class="session-item">
            <span>Total Sessions</span>
            <span class="stat-value">${stats.totalSessions}</span>
          </div>
          <div class="session-item">
            <span>Commits Analyzed</span>
            <span class="stat-value">${stats.totalCommitsAnalyzed.toLocaleString()}</span>
          </div>
          <div class="session-item">
            <span>Average Score</span>
            <span class="stat-value">${stats.avgVibeScore}%</span>
          </div>
          <div class="session-item">
            <span>Zero-Spiral Sessions</span>
            <span class="stat-value">${stats.spiralsAvoided}</span>
          </div>
        </div>
      </div>
    `;
  }

  toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('collapsed');
  }

  async refresh() {
    await this.loadProfile();
    this.renderDashboard();
    this.showToast('Data refreshed!');
  }

  showToast(message) {
    const toast = document.getElementById('toast');
    document.getElementById('toastMessage').textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
  }

  closeModal() {
    document.getElementById('achievementModal').classList.remove('show');
  }

  closeSessionModal() {
    document.getElementById('sessionModal').classList.remove('show');
    // Destroy detail chart to free memory
    if (this.charts.detailRadar) {
      this.charts.detailRadar.destroy();
      this.charts.detailRadar = null;
    }
  }

  closeMetricsModal() {
    document.getElementById('metricsModal')?.classList.remove('show');
  }

  showMetricsHelp(type) {
    const modal = document.getElementById('metricsModal');
    const title = document.getElementById('metricsModalTitle');
    const content = document.getElementById('metricsHelpContent');
    if (!modal || !content) return;

    if (type === 'codeHealth') {
      title.textContent = 'Code Health Rating';
      content.innerHTML = `
        <div class="metrics-help-section">
          <p class="metrics-intro">Code Health grades your <strong>actual coding outcomes</strong>. It's calculated from 5 metrics that measure whether your code works on first try.</p>

          <h3>The 5 Quality Metrics</h3>

          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-name">Iteration Velocity</span>
              <span class="metric-formula">commits / active hours</span>
            </div>
            <p>How fast you're committing. Tight feedback loops catch issues early.</p>
            <div class="metric-thresholds">
              <span class="threshold elite">ELITE: >5/hr</span>
              <span class="threshold high">HIGH: >=3/hr</span>
              <span class="threshold medium">MEDIUM: >=1/hr</span>
              <span class="threshold low">LOW: <1/hr</span>
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-name">Rework Ratio</span>
              <span class="metric-formula">fix commits / total commits</span>
            </div>
            <p>How much time you spend debugging vs building. Lower is better.</p>
            <div class="metric-thresholds">
              <span class="threshold elite">ELITE: <30%</span>
              <span class="threshold high">HIGH: <50%</span>
              <span class="threshold medium">MEDIUM: <70%</span>
              <span class="threshold low">LOW: >=70%</span>
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-name">Trust Pass Rate</span>
              <span class="metric-formula">commits without immediate fix / total</span>
            </div>
            <p>Does your code stick on first try? A commit "fails" if followed by a fix within 30min.</p>
            <div class="metric-thresholds">
              <span class="threshold elite">ELITE: >95%</span>
              <span class="threshold high">HIGH: >=80%</span>
              <span class="threshold medium">MEDIUM: >=60%</span>
              <span class="threshold low">LOW: <60%</span>
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-name">Debug Spiral Duration</span>
              <span class="metric-formula">avg minutes in 3+ consecutive fix chains</span>
            </div>
            <p>How long you stay stuck when debugging. Spirals = 3+ fixes to same component.</p>
            <div class="metric-thresholds">
              <span class="threshold elite">ELITE: <15m</span>
              <span class="threshold high">HIGH: <30m</span>
              <span class="threshold medium">MEDIUM: <60m</span>
              <span class="threshold low">LOW: >=60m</span>
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-name">Flow Efficiency</span>
              <span class="metric-formula">(active time - spiral time) / active time</span>
            </div>
            <p>Percentage of time spent building vs stuck debugging.</p>
            <div class="metric-thresholds">
              <span class="threshold elite">ELITE: >90%</span>
              <span class="threshold high">HIGH: >=75%</span>
              <span class="threshold medium">MEDIUM: >=50%</span>
              <span class="threshold low">LOW: <50%</span>
            </div>
          </div>

          <h3>How It's Calculated</h3>
          <p>Each metric gets rated (ELITE=4, HIGH=3, MEDIUM=2, LOW=1). Your Code Health is the average:</p>
          <div class="formula-box">
            avg >= 3.5 → ELITE | avg >= 2.5 → HIGH | avg >= 1.5 → MEDIUM | else → LOW
          </div>
        </div>
      `;
    } else if (type === 'patternScore') {
      title.textContent = 'Pattern Score';
      content.innerHTML = `
        <div class="metrics-help-section">
          <p class="metrics-intro">Pattern Score detects <strong>workflow problems</strong> even without conventional commit messages. It's an early warning system for trouble.</p>

          <h3>The 4 Pattern Metrics</h3>

          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-name">File Churn</span>
              <span class="metric-weight">30% weight</span>
            </div>
            <p>Files touched 3+ times in 1 hour. High churn suggests thrashing or incomplete understanding.</p>
            <div class="metric-formula">score = (1 - churned_files / total_files) × 100</div>
            <div class="metric-thresholds">
              <span class="threshold elite">ELITE: >90%</span>
              <span class="threshold high">HIGH: 75-90%</span>
              <span class="threshold medium">MEDIUM: 60-75%</span>
              <span class="threshold low">LOW: <60%</span>
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-name">Time Spiral</span>
              <span class="metric-weight">25% weight</span>
            </div>
            <p>Commits less than 5 minutes apart. Rapid commits suggest frustrated iteration.</p>
            <div class="metric-formula">score = (1 - rapid_commits / total_commits) × 100</div>
            <div class="metric-thresholds">
              <span class="threshold elite">ELITE: >85%</span>
              <span class="threshold high">HIGH: 70-85%</span>
              <span class="threshold medium">MEDIUM: 50-70%</span>
              <span class="threshold low">LOW: <50%</span>
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-name">Velocity Anomaly</span>
              <span class="metric-weight">20% weight</span>
            </div>
            <p>How far from your personal baseline. Unusual velocity (too fast/slow) signals problems.</p>
            <div class="metric-formula">z-score = |velocity - baseline| / stdDev</div>
            <div class="metric-thresholds">
              <span class="threshold elite">ELITE: <1σ</span>
              <span class="threshold high">HIGH: <1.5σ</span>
              <span class="threshold medium">MEDIUM: <2σ</span>
              <span class="threshold low">LOW: >=2σ</span>
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-name">Code Stability</span>
              <span class="metric-weight">25% weight</span>
            </div>
            <p>What percentage of added code survives. High churn = building on wrong assumptions.</p>
            <div class="metric-formula">score = (1 - deletions/additions × 0.5) × 100</div>
            <div class="metric-thresholds">
              <span class="threshold elite">ELITE: >=85%</span>
              <span class="threshold high">HIGH: >=70%</span>
              <span class="threshold medium">MEDIUM: >=50%</span>
              <span class="threshold low">LOW: <50%</span>
            </div>
          </div>

          <h3>How It's Calculated</h3>
          <p>Weighted sum of all pattern metrics:</p>
          <div class="formula-box">
            Pattern Score = (fileChurn × 0.30) + (timeSpiral × 0.25) + (velocityAnomaly × 0.20) + (codeStability × 0.25)
          </div>
        </div>
      `;
    }

    modal.classList.add('show');
  }

  // Derive rating from vibeScore to ensure consistency
  scoreToRating(score) {
    if (score >= 85) return 'ELITE';
    if (score >= 70) return 'HIGH';
    if (score >= 50) return 'MEDIUM';
    return 'LOW';
  }

  showSessionDetail(session) {
    if (!session) return;

    // Update modal content
    const scoreRing = document.querySelector('.detail-score-ring');
    scoreRing.style.setProperty('--score', session.vibeScore);

    // Calculate rating from score to ensure badge matches displayed percentage
    const rating = this.scoreToRating(session.vibeScore);
    document.getElementById('detailScore').textContent = `${session.vibeScore}%`;
    document.getElementById('detailRating').textContent = rating;
    document.getElementById('detailDate').textContent = this.formatDateLong(session.date);
    document.getElementById('detailXP').textContent = session.xpEarned || 0;
    document.getElementById('detailCommits').textContent = session.commits;
    document.getElementById('detailSpirals').textContent = session.spirals;

    // Use real metrics if available, otherwise estimate
    const metrics = session.metrics;
    const velocity = metrics?.iterationVelocity?.toFixed(1) || `~${Math.round(session.commits / 2)}`;
    const trustRate = metrics?.trustPassRate?.toFixed(0) || Math.max(0, 100 - (session.spirals * 10));
    document.getElementById('detailVelocity').textContent = `${velocity}/hr`;
    document.getElementById('detailTrust').textContent = `${trustRate}%`;

    // Render detail radar chart
    this.renderDetailRadar(session);

    // Show modal
    document.getElementById('sessionModal').classList.add('show');
  }

  renderDetailRadar(session) {
    const canvas = document.getElementById('detailRadarCanvas');
    if (!canvas) return;

    // Destroy existing chart
    if (this.charts.detailRadar) {
      this.charts.detailRadar.destroy();
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Use real metrics if available, otherwise estimate from session data
    const m = session.metrics;
    let data;
    if (m) {
      data = [
        Math.min(100, m.trustPassRate),
        Math.min(100, m.iterationVelocity * 10),
        Math.min(100, m.flowEfficiency),
        Math.max(0, 100 - m.reworkRatio),
        Math.max(0, 100 - m.debugSpiralDuration * 2),
      ];
    } else {
      // Fallback to estimates
      const trustPass = Math.max(0, 100 - (session.spirals * 15));
      const velocity = Math.min(100, (session.commits / 50) * 100);
      const flow = session.vibeScore;
      const stability = session.spirals === 0 ? 100 : Math.max(0, 100 - (session.spirals * 20));
      const noSpirals = session.spirals === 0 ? 100 : Math.max(0, 100 - (session.spirals * 25));
      data = [trustPass, velocity, flow, stability, noSpirals];
    }

    this.charts.detailRadar = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: ['Trust Pass', 'Velocity', 'Flow', 'Stability', 'No Spirals'],
        datasets: [{
          label: m ? 'Session Metrics' : 'Estimated',
          data: data,
          borderColor: '#58a6ff',
          backgroundColor: 'rgba(88, 166, 255, 0.2)',
          pointBackgroundColor: '#58a6ff',
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false },
        },
        scales: {
          r: {
            min: 0,
            max: 100,
            grid: { color: '#30363d' },
            angleLines: { color: '#30363d' },
            pointLabels: { color: '#7d8590', font: { size: 10 } },
            ticks: { display: false },
          }
        }
      }
    });
  }

  showAchievementModal(achievement) {
    document.getElementById('modalAchievementIcon').textContent = achievement.icon;
    document.getElementById('modalAchievementName').textContent = achievement.name;
    document.getElementById('modalAchievementDesc').textContent = achievement.description;
    document.getElementById('achievementModal').classList.add('show');
  }

  getLevelIcon(level) {
    const icons = ['🌱', '🌿', '🌳', '🌲', '🎋', '🏔️'];
    return icons[level - 1] || '🌱';
  }

  formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  formatDateLong(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }
}

// Initialize dashboard
const dashboard = new VibeDashboard();
document.addEventListener('DOMContentLoaded', () => {
  dashboard.init();
  // Retry chart init after a delay in case Chart.js loaded late
  if (!dashboard.charts.trend) {
    setTimeout(() => {
      console.log('Retrying chart initialization...');
      dashboard.initCharts();
    }, 500);
  }
});
