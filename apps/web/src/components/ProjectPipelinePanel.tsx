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
import type { AgentId, AgentRunRecord, AgentRunStatus, EpisodeStageStatus } from '@creator-ai-studio/shared';
import type { ProjectStatus } from '../types';
import type { WorkspaceTab } from '../lib/dashboardNavigation';
import {
  PIPELINE_STEPS,
  agentDisplayName,
  agentsForStep,
  stepForColumn,
  stepIndex,
  workspaceTabForAgent,
  type PipelineStep,
} from '../lib/projectPipeline';
import {
  approveAgentRun,
  fetchAgentRuns,
  fetchEpisodeDetail,
  runEpisodeAgent,
  updateStageStatus,
} from '../api';
import type { EpisodeSyncState } from '../hooks/useEpisodeSync';

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

function stepperChipClass(step: PipelineStep, index: number, currentIndex: number, viewingStep: PipelineStep): string {
  const done = index < currentIndex;
  const isProjectCurrent = index === currentIndex;
  const isViewing = step.column === viewingStep.column;

  const base =
    'shrink-0 flex items-center gap-1 text-[9px] font-mono uppercase tracking-wide px-2 py-1 rounded-lg border cursor-pointer transition-colors';

  if (isViewing) {
    if (done) {
      return `${base} border-emerald-400/60 bg-emerald-950/40 text-emerald-300 ring-1 ring-emerald-500/40 hover:bg-emerald-950/55`;
    }
    if (isProjectCurrent) {
      return `${base} border-indigo-400/70 bg-indigo-950/40 text-indigo-100 ring-1 ring-indigo-500/50 hover:bg-indigo-950/55`;
    }
    return `${base} border-slate-400/40 bg-slate-800/40 text-slate-200 ring-1 ring-slate-500/30 hover:bg-slate-800/60`;
  }

  if (isProjectCurrent) {
    return `${base} border-indigo-500/50 bg-indigo-950/30 text-indigo-200 hover:bg-indigo-950/45`;
  }
  if (done) {
    return `${base} border-emerald-500/20 bg-emerald-950/20 text-emerald-400/80 hover:border-emerald-500/40 hover:bg-emerald-950/35 hover:text-emerald-300`;
  }
  return `${base} border-white/5 text-slate-500 hover:border-white/15 hover:bg-white/5 hover:text-slate-300`;
}

interface ProjectPipelinePanelProps {
  episodeId: string;
  projectStatus: ProjectStatus;
  episodeSync?: EpisodeSyncState;
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
  episodeSync,
  onGoToTab,
}: ProjectPipelinePanelProps) {
  const currentStep = stepForColumn(projectStatus);
  const currentIndex = stepIndex(projectStatus);
  const [viewingStep, setViewingStep] = useState<PipelineStep>(currentStep);
  const [runs, setRuns] = useState<AgentRunRecord[]>([]);
  const [stageStatus, setStageStatus] = useState<EpisodeStageStatus>('pending');
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<AgentId>(currentStep.agentId);

  const isViewingCurrentProjectStep = viewingStep.column === currentStep.column;

  const load = useCallback(async () => {
    setError(null);
    try {
      const [detail, runsData] = await Promise.all([
        fetchEpisodeDetail(episodeId),
        fetchAgentRuns(episodeId),
      ]);
      const stage = detail.stages.find(s => s.stage === viewingStep.episodeStage);
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
  }, [episodeId, viewingStep.episodeStage]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setViewingStep(currentStep);
    setSelectedAgentId(currentStep.agentId);
  }, [currentStep.column, currentStep.agentId]);

  const activeRun = loading ? undefined : latestRunForAgent(runs, selectedAgentId);
  const stepAgents = agentsForStep(viewingStep);

  useEffect(() => {
    if (activeRun?.status !== 'running' && !episodeSync?.isBackgroundActive) return;
    const interval = window.setInterval(() => {
      void load();
      void episodeSync?.refresh();
    }, 4000);
    return () => window.clearInterval(interval);
  }, [activeRun?.status, episodeSync?.isBackgroundActive, load, episodeSync]);

  const handleSelectStep = (step: PipelineStep) => {
    setViewingStep(step);
    setSelectedAgentId(step.agentId);
    onGoToTab(step.workspaceTab);
  };

  const handleSelectAgent = (agentId: AgentId) => {
    setSelectedAgentId(agentId);
    onGoToTab(workspaceTabForAgent(agentId, viewingStep.workspaceTab));
  };

  const handleRunAgent = async (agentId: AgentId = selectedAgentId) => {
    setRunning(true);
    setError(null);
    try {
      const { job } = await runEpisodeAgent(episodeId, agentId, {
        autoEnqueuePlan: agentId === 'hermes',
      });
      episodeSync?.trackJob(job.id);
      await load();
      void episodeSync?.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo ejecutar el agente');
    } finally {
      setRunning(false);
    }
  };

  const handleAgentPillDoubleClick = (agentId: AgentId) => {
    setSelectedAgentId(agentId);
    void handleRunAgent(agentId);
  };

  const handleApproveStage = async () => {
    setApproving(true);
    try {
      await updateStageStatus(episodeId, viewingStep.episodeStage, 'completed');
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
    <section
      id="project-pipeline-panel"
      className="bg-[#15191E] border border-white/5 rounded-2xl p-5 space-y-5 scroll-mt-4"
    >
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
          const isViewing = step.column === viewingStep.column;
          return (
            <li key={step.column}>
              <button
                type="button"
                aria-current={isViewing ? 'step' : undefined}
                title={`Ver etapa ${step.column}`}
                onClick={() => handleSelectStep(step)}
                className={stepperChipClass(step, index, currentIndex, viewingStep)}
              >
                {done ? <CheckCircle2 className="w-3 h-3" /> : null}
                {step.column}
              </button>
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

      {/* Viewing step detail */}
      <div
        className={`rounded-xl border p-4 space-y-4 ${
          isViewingCurrentProjectStep
            ? 'border-indigo-500/30 bg-indigo-950/15'
            : 'border-emerald-500/25 bg-emerald-950/10'
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p
              className={`text-[10px] font-mono uppercase tracking-wider ${
                isViewingCurrentProjectStep ? 'text-indigo-300' : 'text-emerald-300'
              }`}
            >
              {isViewingCurrentProjectStep ? 'Etapa actual' : 'Revisando etapa'} · {viewingStep.column}
            </p>
            <h3 className="text-sm font-bold text-white mt-1">{viewingStep.label}</h3>
            <p className="text-[11px] text-slate-400 mt-1 max-w-xl">{viewingStep.description}</p>
          </div>
          <span
            className={`rounded-full border px-2.5 py-0.5 text-[10px] font-mono uppercase ${STATUS_PILL[stageStatus]}`}
          >
            {STATUS_LABEL[stageStatus]}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {stepAgents.map(agentId => {
            const name = agentDisplayName(agentId);
            return (
              <button
                key={agentId}
                type="button"
                title="Clic para seleccionar · doble clic para ejecutar"
                onClick={() => handleSelectAgent(agentId)}
                onDoubleClick={() => void handleAgentPillDoubleClick(agentId)}
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
            disabled={approving || stageStatus === 'completed' || !isViewingCurrentProjectStep}
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
            onClick={() => onGoToTab(workspaceTabForAgent(selectedAgentId, viewingStep.workspaceTab))}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-white/10 text-xs text-slate-300 hover:text-white cursor-pointer"
          >
            Editar contenido
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          {viewingStep.column === 'Edición' && (
            <>
              <button
                type="button"
                onClick={() => onGoToTab('subtitulos')}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-yellow-500/30 text-xs text-yellow-300 hover:text-yellow-200 cursor-pointer"
              >
                Subtítulos
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onGoToTab('shorts')}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-fuchsia-500/30 text-xs text-fuchsia-300 hover:text-fuchsia-200 cursor-pointer"
              >
                Shorts
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </>
          )}
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
