export default function AuthMisconfiguredView() {
  return (
    <div className="min-h-screen bg-[#0B0F14] text-[#E6EDF2] flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-[#15191E] border border-amber-500/20 rounded-2xl p-8 shadow-2xl space-y-4">
        <p className="text-[10px] uppercase tracking-[0.2em] text-amber-400 font-semibold">
          Configuración requerida
        </p>
        <h1 className="text-xl font-bold text-white">Inicio de sesión no disponible</h1>
        <p className="text-sm text-[#8B949E] leading-relaxed">
          La API de staging exige autenticación, pero esta build del dashboard no incluye las
          variables <code className="text-amber-200">VITE_SUPABASE_URL</code> y{' '}
          <code className="text-amber-200">VITE_SUPABASE_ANON_KEY</code>.
        </p>
        <p className="text-sm text-[#8B949E] leading-relaxed">
          Añádelas en <code className="text-slate-300">.env.supabase.local</code> en el VPS y vuelve
          a desplegar la imagen web (rebuild). Consulta{' '}
          <code className="text-slate-300">docs/02-operations/SUPABASE_AUTH.md</code>.
        </p>
      </div>
    </div>
  );
}
