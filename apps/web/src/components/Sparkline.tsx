import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface SparklineProps {
  id: string;
}

export default function Sparkline({ id }: SparklineProps) {
  // Generate a stable 7-day trend based on the project id hash
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const trend: number[] = [];
  for (let i = 0; i < 7; i++) {
    // some semi-random but stable values between 15 and 95
    const val = 15 + Math.abs((hash + i * 37) % 80);
    trend.push(val);
  }

  const change = ((trend[6] - trend[0]) / trend[0]) * 100;
  const isPositive = change >= 0;

  // Map trend to points on SVG of width 140, height 28
  const width = 140;
  const height = 28;
  const paddingY = 3;
  const minVal = Math.min(...trend);
  const maxVal = Math.max(...trend);
  const range = maxVal - minVal || 1;

  const points = trend.map((val, i) => {
    const x = (i * width) / 6;
    const y = height - paddingY - ((val - minVal) / range) * (height - 2 * paddingY);
    return { x, y };
  });

  const linePath = points.reduce((acc, p, i) => {
    return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
  }, '');

  const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;

  return (
    <div id={`sparkline-${id}`} className="flex items-center justify-between gap-3 bg-white/[0.02] border border-white/5 rounded-xl p-2 mt-2">
      <div className="flex flex-col shrink-0">
        <span className="text-[9px] text-slate-500 uppercase tracking-wider font-mono">Engagement (7d)</span>
        <div className="flex items-center gap-1 mt-0.5">
          {isPositive ? (
            <ArrowUpRight className="w-3 h-3 text-emerald-400 shrink-0" />
          ) : (
            <ArrowDownRight className="w-3 h-3 text-rose-400 shrink-0" />
          )}
          <span className={`text-[10px] font-bold font-mono ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isPositive ? '+' : ''}{change.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* SVG Sparkline */}
      <div className="flex-1 max-w-[120px] h-7 relative">
        <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id={`sparkline-grad-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={isPositive ? '#10b981' : '#f43f5e'} stopOpacity="0.25" />
              <stop offset="100%" stopColor={isPositive ? '#10b981' : '#f43f5e'} stopOpacity="0.0" />
            </linearGradient>
          </defs>
          
          {/* Fill Area */}
          <path
            d={areaPath}
            fill={`url(#sparkline-grad-${id})`}
            stroke="none"
          />

          {/* Line stroke */}
          <path
            d={linePath}
            fill="none"
            stroke={isPositive ? '#10b981' : '#f43f5e'}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Last Day Dot */}
          <circle
            cx={points[6].x}
            cy={points[6].y}
            r="2"
            fill={isPositive ? '#34d399' : '#fb7185'}
          />
        </svg>
      </div>
    </div>
  );
}
