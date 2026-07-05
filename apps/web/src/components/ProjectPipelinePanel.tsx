import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  ChevronRight,
  Loader2,
  Play,
  Terminal,
  UserCheck,
  XCircle,
} from 'lucide-react';
import type { AgentRunRecord, AgentRunStatus, EpisodeStageStatus } from '@creator-ai-studio/shared';
import type { ProjectStatus } from '../types';
import type { WorkspaceTab } from '../lib/dashboardNavigation';
import {
  PIPELINE_STEPS,
  agentsForStep,
  stepForColumn,
  stepIndex,
} from '../lib/projectPipeline';
import {
  approveAgentRun,
  fetchAgentRuns,
  fetchEpisodeDetail,
  runEpisodeAgent,
  updateStageStatus,
} from '../api';

const STATUS_LABEL: Record<EpisodeStageStatus, string> = {
  pending: 'Pendiente',
  in_progress: 'En progreso',
  completed: 'Aprobado',
  blocked: 'Bloqueado',
};

const STATUS_PILL: Record<EpisodeStageStatus, string> = {
  pending: 'border-slate-500/30 bg-slate-500/10 text-slate-300',
  in_progress: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300',
  completed: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  blocked: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
};

const RUN_STATUS_LABEL: Record<AgentRunStatus, string> = {
  running: 'En ejecución',
  completed: 'Completado',
  failed: 'Error',
  blocked: 'Bloqueado — requiere corrección',
  awaiting_approval: 'Pendiente de aprobación',
};

function runStatusTone(status: AgentRunStatus): string {
  if (status === 'completed') return 'text-emerald-400';
  if (status === 'blocked' || status === 'failed') return 'text-rose-400';
  if (status === 'awaiting_approval') return 'text-amber-400';
  return 'text-slate-400';
}

interface ProjectPipelinePanelProps {
  episodeId: string;
  projectStatus: ProjectStatus;
  onGoToTab: (tab: WorkspaceTab) => void;
}

function latestRunForAgent(runs: AgentRunRecord[] | undefined, agentId: string): AgentRunRecord | undefined {
  return (runs ?? [])
    .filter(r => r.agentId === agentId)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
}

export default function ProjectPipelinePanel({
  episodeId,
  projectStatus,
  onGoToTab,
}: ProjectPipelinePanelProps) {
  const currentStep = stepForColumn(projectStatus);
  const currentIndex = stepIndex(projectStatus);
  const [runs, setRuns] = useState<AgentRunRecord[]>([]);
  const [stageStatus, setStageStatus] = useState<EpisodeStageStatus>('pending');
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState(currentStep.agentId);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [detail, runsData] = await Promise.all([
        fetchEpisodeDetail(episodeId),
        fetchAgentRuns(episodeId),
      ]);
      const stage = detail.stages.find(s => s.stage === currentStep.episodeStage);
      setStageStatus(stage?.status ?? 'pending');
      setRuns(runsData.runs ?? []);
    } catch (e) {
      setError(
        e instanceof Error && e.message.includes('episodio')
          ? e.message
          : 'No se pudo cargar el detalle del episodio',
      );
    } finally {
      setLoading(false);
    }
  }, [episodeId, currentStep.episodeStage]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setSelectedAgentId(currentStep.agentId);
  }, [currentStep.agentId]);

  const activeRun = loading ? undefined : latestRunForAgent(runs, selectedAgentId);
  const stepAgents = agentsForStep(currentStep);

  const handleRunAgent = async () => {
    setRunning(true);
    setError(null);
    try {
      await runEpisodeAgent(episodeId, selectedAgentId, {
        autoEnqueuePlan: selectedAgentId === 'hermes',
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo ejecutar el agente');
    } finally {
      setRunning(false);
    }
  };

  const handleApproveStage = async () => {
    setApproving(true);
    try {
      await updateStageStatus(episodeId, currentStep.episodeStage, 'completed');
      setStageStatus('completed');
    } catch {
      setError('No se pudo aprobar la etapa');
    } finally {
      setApproving(false);
    }
  };

  const handleApproveRun = async () => {
    if (!activeRun?.id) return;
    setApproving(true);
    try {
      await approveAgentRun(episodeId, activeRun.id);
      await load();
    } catch {
      setError('No se pudo aprobar la ejecución del agente');
    } finally {
      setApproving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400 py-4">
        <Loader2 className="w-4 h-4 animate-spin" />
        Cargando pipeline del proyecto…
      </div>
    );
  }

  return (
    <section className="bg-[#15191E] border border-white/5 rounded-2xl p-5 space-y-5">
      <div>
        <h2 className="font-display font-bold text-base text-white">Pipeline del proyecto</h2>
        <p className="text-[11px] text-slate-400 mt-0.5">
          Cada columna del tablero Kanban corresponde a un agente y una etapa de este episodio.
        </p>
      </div>

      {/* Kanban stepper */}
      <ol className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
        {PIPELINE_STEPS.map((step, index) => {
          const done = index < currentIndex;
          const active = index === currentIndex;
          return (
            <li
              key={step.column}
              className={`shrink-0 flex items-center gap-1 text-[9px] font-mono uppercase tracking-wide px-2 py-1 rounded-lg border ${
                active
                  ? 'border-indigo-500/50 bg-indigo-950/30 text-indigo-200'
                  : done
                    ? 'border-emerald-500/20 bg-emerald-950/20 text-emerald-400/80'
                    : 'border-white/5 text-slate-500'
              }`}
            >
              {done ? <CheckCircle2 className="w-3 h-3" /> : null}
              {step.column}
            </li>
          );
        })}
      </ol>

      {error && (
        <p
          role="alert"
          className="text-xs text-rose-300 rounded-xl border border-rose-500/30 bg-rose-950/20 px-3 py-2"
        >
          {error}
        </p>
      )}

      {/* Current step */}
      <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/15 p-4 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] text-indigo-300 font-mono uppercase tracking-wider">
              Etapa actual · {currentStep.column}
            </p>
            <h3 className="text-sm font-bold text-white mt-1">{currentStep.label}</h3>
            <p className="text-[11px] text-slate-400 mt-1 max-w-xl">{currentStep.description}</p>
          </div>
          <span
            className={`rounded-full border px-2.5 py-0.5 text-[10px] font-mono uppercase ${STATUS_PILL[stageStatus]}`}
          >
            {STATUS_LABEL[stageStatus]}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {stepAgents.map(agentId => {
            const step = PIPELINE_STEPS.find(s => s.agentId === agentId);
            const name =
              step?.agentName ??
              (agentId === 'doctrine_reviewer'
                ? 'Revisor doctrinal'
                : agentId === 'editorial_reviewer'
                  ? 'Revisor editorial'
                  : agentId === 'storyboard_designer'
                    ? 'Storyboard'
                    : agentId === 'scene_asset_designer'
                      ? 'Assets visuales'
                      : agentId === 'audio_engineer'
                        ? 'Ingeniero audio'
                        : agentId);
            return (
              <button
                key={agentId}
                type="button"
                onClick={() => setSelectedAgentId(agentId)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border cursor-pointer transition-colors ${
                  selectedAgentId === agentId
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : 'bg-[#0B0F14] border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                {name}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={running}
            onClick={() => void handleRunAgent()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold cursor-pointer"
          >
            {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            Ejecutar agente
          </button>
          <button
            type="button"
            disabled={approving || stageStatus === 'completed'}
            onClick={() => void handleApproveStage()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-600/40 text-emerald-300 hover:bg-emerald-950/30 disabled:opacity-50 text-xs font-bold cursor-pointer"
          >
            <UserCheck className="w-3.5 h-3.5" />
            Aprobar etapa
          </button>
          {activeRun?.status === 'awaiting_approval' && activeRun.id && (
            <button
              type="button"
              disabled={approving}
              onClick={() => void handleApproveRun()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600/80 hover:bg-amber-500 text-xs font-bold text-white cursor-pointer disabled:opacity-50"
            >
              Aprobar ejecución
            </button>
          )}
          <button
            type="button"
            onClick={() => onGoToTab(currentStep.workspaceTab)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-white/10 text-xs text-slate-300 hover:text-white cursor-pointer"
          >
            Editar contenido
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {activeRun && (
          <div className="rounded-lg border border-white/5 bg-[#0B0F14] p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
              <Terminal className="w-3.5 h-3.5 text-indigo-400" />
              <span>
                Última ejecución ·{' '}
                <span className={runStatusTone(activeRun.status)}>
                  {RUN_STATUS_LABEL[activeRun.status] ?? activeRun.status}
                </span>
              </span>
              {activeRun.qualityGate && (
                <span className={activeRun.qualityGate.passed ? 'text-emerald-400' : 'text-rose-400'}>
                  {activeRun.qualityGate.passed ? (
                    <CheckCircle2 className="w-3 h-3 inline" />
                  ) : (
                    <XCircle className="w-3 h-3 inline" />
                  )}
                </span>
              )}
            </div>
            {activeRun.qualityGate && (
              <div className="flex flex-wrap gap-1">
                {activeRun.qualityGate.checks.map(check => (
                  <span
                    key={check.key}
                    title={check.detail ?? check.label}
                    className={`inline-flex items-center gap-0.5 text-[8px] px-1.5 py-0.5 rounded border ${
                      check.ok
                        ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
                        : 'border-rose-500/30 text-rose-400 bg-rose-500/10'
                    }`}
                  >
                    {check.ok ? (
                      <CheckCircle2 className="w-2.5 h-2.5" />
                    ) : (
                      <XCircle className="w-2.5 h-2.5" />
                    )}
                    {check.label}
                  </span>
                ))}
              </div>
            )}
            <div className="max-h-28 overflow-y-auto font-mono text-[10px] text-slate-500 space-y-1">
              {activeRun.logs.slice(-6).map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
