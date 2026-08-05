import { useCallback, useEffect, useState } from 'react';
import { Church, Plus, ShieldCheck, Trash2, UserPlus, Users2, X } from 'lucide-react';
import {
  CHURCH_PERMISSIONS,
  CHURCH_ROLES,
  CHURCH_ROLE_DESCRIPTIONS,
  CHURCH_ROLE_LABELS,
  roleCan,
  type ChurchPermission,
  type ChurchRole,
} from '@creator-ai-studio/shared';
import {
  addMember,
  createMinistry,
  deleteMinistry,
  removeMember,
  updateChurch,
  updateMember,
} from '../api';
import { useChurch } from '../ChurchContext';
import {
  Button,
  Card,
  EmptyState,
  Field,
  PermissionNotice,
  RolePill,
  SectionHeader,
  inputClass,
  selectClass,
} from '../components/primitives';

/**
 * "Equipo" — roster, ministries and church settings.
 *
 * The permission matrix is rendered here on purpose: a volunteer who wonders
 * "why can't I publish?" gets the answer on the same screen as their role,
 * instead of hitting a 403 and asking someone.
 */

const PERMISSION_LABELS: Record<ChurchPermission, string> = {
  'library.view': 'Ver biblioteca',
  'asset.upload': 'Subir material',
  'asset.delete': 'Borrar material',
  'production.create': 'Crear producciones',
  'production.edit_script': 'Editar guion',
  'production.upload_art': 'Subir arte y miniaturas',
  'production.render': 'Lanzar render',
  'production.approve': 'Aprobar',
  'production.publish': 'Publicar',
  'live.control': 'Controlar transmisión',
  'team.manage': 'Gestionar equipo',
  'credentials.manage': 'Ver o editar credenciales',
  'comment.write': 'Comentar',
};

export default function TeamView() {
  const { church, members, ministries, role, can, refresh, refreshDirectory } = useChurch();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [ministryName, setMinistryName] = useState('');
  const [churchName, setChurchName] = useState(church?.name ?? '');
  const [timezone, setTimezone] = useState(church?.timezone ?? 'America/Bogota');

  useEffect(() => {
    setChurchName(church?.name ?? '');
    setTimezone(church?.timezone ?? 'America/Bogota');
  }, [church?.name, church?.timezone]);

  const run = useCallback(
    async (action: () => Promise<unknown>) => {
      setBusy(true);
      setError(null);
      try {
        await action();
        await refreshDirectory();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo completar la acción');
      } finally {
        setBusy(false);
      }
    },
    [refreshDirectory],
  );

  const canManage = can('team.manage');

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Equipo</h1>
          <p className="text-sm text-[#A9B4C0] mt-1">
            Quién es quién, qué puede hacer cada uno y cómo está configurada la iglesia.
          </p>
        </div>
        {canManage && (
          <Button variant="primary" icon={UserPlus} onClick={() => setInviteOpen(true)}>
            Agregar integrante
          </Button>
        )}
      </header>

      {error && (
        <p className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2.5">
          {error}
        </p>
      )}

      <Card className="p-5">
        <SectionHeader icon={Users2} title="Integrantes" description={`${members.length} en el equipo.`} />
        {members.length === 0 ? (
          <EmptyState
            icon={Users2}
            title="Solo estás tú"
            description="Agrega a los demás con su correo. Deben haber creado su cuenta primero."
            action={
              canManage ? (
                <Button variant="secondary" icon={UserPlus} onClick={() => setInviteOpen(true)}>
                  Agregar integrante
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="space-y-2">
            {members.map(member => (
              <li
                key={member.id}
                className="flex flex-wrap items-center gap-3 bg-[#0B0F14] border border-white/8 rounded-xl px-3.5 py-3"
              >
                <span className="w-9 h-9 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-sm font-bold text-indigo-300 shrink-0">
                  {(member.displayName || member.email || '?').charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white truncate">
                    {member.displayName || member.title || 'Integrante'}
                  </p>
                  {member.email && (
                    <p className="text-[11px] text-[#7C8794] truncate">{member.email}</p>
                  )}
                </div>

                {canManage ? (
                  <>
                    <label htmlFor={`role-${member.id}`} className="sr-only">
                      Rol de {member.displayName ?? 'integrante'}
                    </label>
                    <select
                      id={`role-${member.id}`}
                      value={member.role}
                      disabled={busy}
                      onChange={event =>
                        void run(() =>
                          updateMember(member.id, { role: event.target.value as ChurchRole }),
                        )
                      }
                      className={`${selectClass} w-40 shrink-0`}
                    >
                      {CHURCH_ROLES.map(option => (
                        <option key={option} value={option}>
                          {CHURCH_ROLE_LABELS[option]}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="ghost"
                      icon={Trash2}
                      compact
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            `¿Sacar a ${member.displayName ?? 'este integrante'} del equipo?`,
                          )
                        ) {
                          void run(() => removeMember(member.id));
                        }
                      }}
                    >
                      Quitar
                    </Button>
                  </>
                ) : (
                  <RolePill role={member.role} />
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-5">
        <SectionHeader
          icon={ShieldCheck}
          title="Qué puede hacer cada rol"
          description={
            role
              ? `Tu rol es ${CHURCH_ROLE_LABELS[role]}. Las filas marcadas son lo que puedes hacer.`
              : 'La tabla completa de permisos.'
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-xs">
            <caption className="sr-only">
              Matriz de permisos por rol de la plataforma
            </caption>
            <thead>
              <tr className="border-b border-white/8">
                <th scope="col" className="text-left font-semibold text-[#A9B4C0] py-2.5 pr-4">
                  Acción
                </th>
                {CHURCH_ROLES.map(option => (
                  <th
                    key={option}
                    scope="col"
                    className={`text-center font-semibold py-2.5 px-2 ${
                      option === role ? 'text-indigo-300' : 'text-[#A9B4C0]'
                    }`}
                  >
                    {CHURCH_ROLE_LABELS[option]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CHURCH_PERMISSIONS.map(permission => (
                <tr key={permission} className="border-b border-white/4">
                  <th
                    scope="row"
                    className="text-left font-medium text-white py-2 pr-4 whitespace-nowrap"
                  >
                    {PERMISSION_LABELS[permission]}
                  </th>
                  {CHURCH_ROLES.map(option => {
                    const allowed = roleCan(option, permission);
                    return (
                      <td
                        key={option}
                        className={`text-center py-2 px-2 ${
                          option === role ? 'bg-indigo-500/[0.06]' : ''
                        }`}
                      >
                        {/* The word, not just the color — never rely on hue alone. */}
                        <span
                          className={
                            allowed ? 'text-emerald-300 font-semibold' : 'text-[#4A5462]'
                          }
                        >
                          {allowed ? 'Sí' : '—'}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 mt-5">
          {CHURCH_ROLES.map(option => (
            <li
              key={option}
              className="bg-[#0B0F14] border border-white/8 rounded-xl px-3.5 py-3"
            >
              <RolePill role={option} />
              <p className="text-[11px] text-[#A9B4C0] mt-2 leading-relaxed">
                {CHURCH_ROLE_DESCRIPTIONS[option]}
              </p>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-5">
        <SectionHeader
          icon={Users2}
          title="Ministerios"
          description="Para agrupar material y producciones por área."
        />
        {canManage && (
          <div className="flex gap-2 mb-4">
            <label htmlFor="new-ministry" className="sr-only">
              Nombre del ministerio
            </label>
            <input
              id="new-ministry"
              value={ministryName}
              onChange={event => setMinistryName(event.target.value)}
              className={inputClass}
              placeholder="Jóvenes, Alabanza, Niños…"
            />
            <Button
              variant="secondary"
              icon={Plus}
              disabled={!ministryName.trim() || busy}
              onClick={() =>
                void run(async () => {
                  await createMinistry({ name: ministryName.trim() });
                  setMinistryName('');
                })
              }
            >
              Agregar
            </Button>
          </div>
        )}

        {ministries.length === 0 ? (
          <p className="text-xs text-[#7C8794]">
            Todavía no hay ministerios. Sin ellos todo queda como “general”.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {ministries.map(ministry => (
              <li
                key={ministry.id}
                className="flex items-center gap-2 bg-[#0B0F14] border border-white/8 rounded-xl pl-3.5 pr-1.5 py-1.5"
              >
                <span className="text-sm text-white">{ministry.name}</span>
                {canManage && (
                  <Button
                    variant="ghost"
                    icon={X}
                    compact
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm(`¿Eliminar el ministerio "${ministry.name}"?`)) {
                        void run(() => deleteMinistry(ministry.id));
                      }
                    }}
                  >
                    Eliminar
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-5">
        <SectionHeader
          icon={Church}
          title="Datos de la iglesia"
          description="El nombre y la zona horaria que usa todo el calendario."
        />
        {canManage ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre" htmlFor="church-name">
              <input
                id="church-name"
                value={churchName}
                onChange={event => setChurchName(event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field
              label="Zona horaria"
              htmlFor="church-tz"
              hint="Ej: America/Bogota, America/Mexico_City."
            >
              <input
                id="church-tz"
                value={timezone}
                onChange={event => setTimezone(event.target.value)}
                className={inputClass}
              />
            </Field>
            <div className="sm:col-span-2">
              <Button
                variant="secondary"
                loading={busy}
                onClick={() =>
                  void run(async () => {
                    await updateChurch({ name: churchName.trim(), timezone: timezone.trim() });
                    await refresh();
                  })
                }
              >
                Guardar
              </Button>
            </div>
          </div>
        ) : (
          <dl className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <dt className="text-[#7C8794]">Nombre</dt>
              <dd className="text-white font-medium mt-0.5">{church?.name}</dd>
            </div>
            <div>
              <dt className="text-[#7C8794]">Zona horaria</dt>
              <dd className="text-white font-medium mt-0.5">{church?.timezone}</dd>
            </div>
          </dl>
        )}
      </Card>

      {!canManage && (
        <PermissionNotice message="Solo un administrador puede cambiar roles, ministerios o los datos de la iglesia." />
      )}

      {inviteOpen && (
        <InviteDialog
          onClose={() => setInviteOpen(false)}
          onAdded={async () => {
            setInviteOpen(false);
            await refreshDirectory();
          }}
        />
      )}
    </div>
  );
}

function InviteDialog({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: () => Promise<void>;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<ChurchRole>('voluntario');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!email.trim()) {
      setError('Escribe el correo de la persona');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await addMember({ email: email.trim(), role });
      await onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo agregar');
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0B0F14]/85 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-title"
    >
      <Card className="w-full max-w-md p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 id="invite-title" className="font-display text-lg font-bold text-white">
              Agregar integrante
            </h2>
            <p className="text-xs text-[#A9B4C0] mt-1">
              La persona debe haber creado su cuenta antes de que puedas agregarla.
            </p>
          </div>
          <Button variant="ghost" icon={X} compact onClick={onClose} disabled={saving}>
            Cerrar
          </Button>
        </div>

        <div className="space-y-4">
          <Field label="Correo" htmlFor="invite-email">
            <input
              id="invite-email"
              type="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              className={inputClass}
              placeholder="nombre@correo.com"
              autoFocus
            />
          </Field>

          <Field label="Rol" htmlFor="invite-role" hint={CHURCH_ROLE_DESCRIPTIONS[role]}>
            <select
              id="invite-role"
              value={role}
              onChange={event => setRole(event.target.value as ChurchRole)}
              className={selectClass}
            >
              {CHURCH_ROLES.map(option => (
                <option key={option} value={option}>
                  {CHURCH_ROLE_LABELS[option]}
                </option>
              ))}
            </select>
          </Field>

          {error && (
            <p className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2.5">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button variant="primary" icon={UserPlus} onClick={() => void submit()} loading={saving}>
              Agregar
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
