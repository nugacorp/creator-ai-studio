import { useEffect, useMemo, useState } from 'react';
import { BarChart3, TrendingUp, Users, Eye, Play, Sparkles, Link2 } from 'lucide-react';
import { fetchAnalytics } from '../api';

type ChannelTab = 'Todos' | 'YouTube' | 'TikTok' | 'Instagram';

function buildChartPaths(data: number[], width = 500, height = 200) {
  if (data.length === 0) {
    return { area: '', line: '', points: [] as Array<{ x: number; y: number }> };
  }

  const max = Math.max(...data, 1);
  const topPad = 20;
  const bottomPad = 30;
  const chartHeight = height - bottomPad;
  const step = data.length > 1 ? width / (data.length - 1) : width;

  const points = data.map((value, index) => ({
    x: index * step,
    y: topPad + (chartHeight - topPad) * (1 - value / max),
  }));

  const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x},${point.y}`).join(' ');
  const area = `${line} L ${width},${height} L 0,${height} Z`;

  return { area, line, points };
}

export default function AnalyticsView() {
  const [activeChannelTab, setActiveChannelTab] = useState<ChannelTab>('Todos');
  const [analytics, setAnalytics] = useState({
    isDemo: false,
<<<<<<< HEAD
    connected: false,
    hasData: false,
=======
>>>>>>> origin/main
    views: 0,
    subscribers: 0,
    watchTimeHours: 0,
    engagement: '0%',
<<<<<<< HEAD
    chartData: [] as number[],
    channelDistribution: [] as Array<{ name: string; views: number; percentage: number }>,
=======
    chartData: [0] as number[],
    channelDistribution: [{ name: 'YouTube', views: 0, percentage: 100 }],
>>>>>>> origin/main
  });
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    void fetchAnalytics()
      .then(data => {
        setLoadError(false);
        setAnalytics({
          isDemo: data.isDemo ?? false,
<<<<<<< HEAD
          connected: data.connected ?? false,
          hasData: data.hasData ?? (data.kpis.views > 0 || data.chartData.length > 0),
=======
>>>>>>> origin/main
          views: data.kpis.views,
          subscribers: data.kpis.subscribers,
          watchTimeHours: data.kpis.watchTimeHours,
          engagement: data.kpis.engagement,
          chartData: data.chartData ?? [],
          channelDistribution: data.channelDistribution ?? [],
        });
      })
      .catch(() => setLoadError(true));
  }, []);

  const channelMultiplier =
    activeChannelTab === 'YouTube'
      ? 1
      : activeChannelTab === 'TikTok'
        ? 0
        : activeChannelTab === 'Instagram'
          ? 0
          : 1;

  const showRealData = analytics.hasData && !analytics.isDemo && analytics.connected;
  const showEmpty = !showRealData && !analytics.isDemo;
  const chart = useMemo(() => buildChartPaths(analytics.chartData), [analytics.chartData]);
  const chartMax = Math.max(...analytics.chartData, 1);

  const mainStats = [
    {
      label: 'Visualizaciones totales',
      count: showRealData ? Math.round(analytics.views * channelMultiplier).toLocaleString() : '—',
      sub: showRealData ? 'YouTube Analytics' : 'Sin datos',
      icon: Eye,
    },
    {
      label: 'Tiempo de reproducción (horas)',
      count: showRealData ? Math.round(analytics.watchTimeHours * channelMultiplier).toLocaleString() : '—',
      sub: showRealData ? '14 días' : 'Sin datos',
      icon: Play,
    },
    {
      label: 'Suscriptores',
      count: showRealData ? Math.round(analytics.subscribers * channelMultiplier).toLocaleString() : '—',
      sub: showRealData ? 'Canal conectado' : 'Sin datos',
      icon: Users,
    },
    {
      label: 'Engagement',
      count: showRealData ? analytics.engagement : '—',
      sub: showRealData ? 'Likes + comentarios / views' : 'Sin datos',
      icon: TrendingUp,
    },
  ];

  const channelDistribution =
    analytics.channelDistribution.length > 0
      ? analytics.channelDistribution.map(ch => ({
          name: ch.name,
          views: ch.views.toLocaleString(),
          percentage: ch.percentage,
          color: 'bg-rose-500',
        }))
      : [];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {analytics.isDemo && (
        <p className="text-xs rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-amber-200">
<<<<<<< HEAD
          Modo demo local — estos números no son reales. En staging/producción conecta YouTube OAuth en
          Configuración.
        </p>
      )}

      {showEmpty && !loadError && (
        <div className="rounded-xl border border-white/10 bg-[#15191E] px-4 py-6 text-center space-y-3">
          <Link2 className="w-8 h-8 text-slate-500 mx-auto" />
          <p className="text-sm text-slate-300 font-medium">Sin métricas de YouTube todavía</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            Conecta Google/YouTube en Configuración → Integraciones. Solo verás datos reales cuando el
            canal esté autorizado y YouTube Analytics responda.
          </p>
        </div>
      )}

      {loadError && (
        <p className="text-xs rounded-xl border border-rose-500/30 bg-rose-950/20 px-4 py-3 text-rose-200">
          No se pudieron cargar las métricas. Verifica la conexión con la API.
        </p>
      )}

=======
          Datos de demostración — conecta YouTube OAuth en Configuración para métricas reales.
        </p>
      )}
>>>>>>> origin/main
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#15191E] p-4.5 rounded-2xl border border-[rgba(255,255,255,0.05)]">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 rounded-2xl text-indigo-400">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display font-bold text-base text-white">Rendimiento de Canales</h2>
            <p className="text-[11px] text-[#8B949E]">Solo datos reales de YouTube Analytics (OAuth)</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-[#0B0F14] p-1 rounded-2xl border border-[rgba(255,255,255,0.05)]">
          {(['Todos', 'YouTube', 'TikTok', 'Instagram'] as ChannelTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveChannelTab(tab)}
              disabled={tab === 'TikTok' || tab === 'Instagram'}
              title={tab === 'TikTok' || tab === 'Instagram' ? 'Próximamente' : undefined}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                activeChannelTab === tab
                  ? 'bg-indigo-600 text-white'
                  : 'text-[#8B949E] hover:text-[#E6EDF2]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {mainStats.map((st, i) => {
          const Icon = st.icon;
          return (
            <div
              key={i}
              className="bg-[#15191E] border border-[rgba(255,255,255,0.05)] rounded-2xl p-4.5 space-y-3 shadow-md"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#8B949E] font-mono leading-none">{st.label}</span>
                <div className="p-1.5 bg-[#0B0F14] rounded text-[#8B949E]">
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="pt-1">
                <span className="text-2xl font-bold font-display text-white">{st.count}</span>
                <p className="text-[10px] text-slate-500 mt-1">{st.sub}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[#15191E] border border-[rgba(255,255,255,0.05)] rounded-2xl p-6 space-y-4 shadow-lg">
          <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.05)] pb-3">
            <h4 className="text-xs font-bold text-white font-mono uppercase tracking-wider">
              Visualizaciones diarias
            </h4>
            <span className="text-[10px] text-slate-500 font-mono font-bold">Últimos 14 días</span>
          </div>

          {analytics.chartData.length === 0 ? (
            <div className="h-60 flex items-center justify-center text-sm text-slate-500 italic">
              {showEmpty ? 'Conecta YouTube para ver la serie temporal' : 'Sin serie diaria disponible'}
            </div>
          ) : (
            <div className="h-60 relative w-full pt-4">
              <svg viewBox="0 0 500 200" className="w-full h-full text-indigo-500 overflow-visible">
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <line x1="0" y1="50" x2="500" y2="50" stroke="rgba(255,255,255,0.05)" strokeDasharray="3,3" />
                <line x1="0" y1="100" x2="500" y2="100" stroke="rgba(255,255,255,0.05)" strokeDasharray="3,3" />
                <line x1="0" y1="150" x2="500" y2="150" stroke="rgba(255,255,255,0.05)" strokeDasharray="3,3" />
                {chart.area && <path d={chart.area} fill="url(#areaGrad)" />}
                {chart.line && (
                  <path d={chart.line} fill="none" stroke="#8b5cf6" strokeWidth="3.5" strokeLinecap="round" />
                )}
                {chart.points.map((point, index) => (
                  <circle
                    key={index}
                    cx={point.x}
                    cy={point.y}
                    r={4.5}
                    fill="#a78bfa"
                    stroke="#0B0F14"
                    strokeWidth="1.5"
                  />
                ))}
              </svg>
              <div className="absolute top-1/4 left-10 text-[9px] font-mono text-[#8B949E]">
                {Math.round(chartMax).toLocaleString()} views
              </div>
            </div>
          )}
        </div>

        <div className="bg-[#15191E] border border-[rgba(255,255,255,0.05)] rounded-2xl p-6 space-y-5 shadow-lg flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.05)] pb-3">
              <h4 className="text-xs font-bold text-white font-mono uppercase tracking-wider">
                Distribución de Tráfico
              </h4>
            </div>

            {channelDistribution.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-6 text-center">Sin datos de tráfico</p>
            ) : (
              <div className="space-y-4.5">
                {channelDistribution.map((ch, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[#E6EDF2]">{ch.name}</span>
                      <span className="text-[#8B949E] font-mono">
                        {ch.views} ({ch.percentage}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-[#0B0F14] rounded-full overflow-hidden p-[1px] border border-[rgba(255,255,255,0.05)]">
                      <div className={`h-full ${ch.color} rounded-full`} style={{ width: `${ch.percentage}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-[#0B0F14] p-4.5 rounded-2xl border border-indigo-900/10 space-y-2 relative overflow-hidden">
            <div className="flex items-center gap-1.5 text-indigo-400 text-xs font-bold">
              <Sparkles className="w-4 h-4" />
              <span>Agente Analítico IA</span>
            </div>
            <p className="text-[10px] text-[#8B949E] leading-relaxed">
              Ejecuta el agente <strong className="text-slate-300">analytics_agent</strong> en un episodio
              publicado para recomendaciones basadas en datos reales.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
