import { useCallback, useEffect, useState } from 'react';
import { Lock, Plus, Trash2, RefreshCw, Check } from 'lucide-react';
import { listSecrets, createSecret, updateSecret, deleteSecret, type SecretView } from '@/api/secrets';
import { ApiError } from '@/api/client';
import { useI18n } from '@/i18n/locale';

// Settings → Secrets (HLD-017). The generic, semantics-agnostic credential
// vault. Skills / external MCP servers declare the secret NAMES they need
// (manifest requires.env) and the runtime injects matching rows as env vars
// at exec time. Values are write-only — the list shows only whether a value
// is set, never the material.
export default function SecretsPage() {
  const { tr } = useI18n();
  const [items, setItems] = useState<SecretView[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // add-form state
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [desc, setDesc] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await listSecrets();
      setItems(r.items ?? []);
      setErr(null);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onAdd = async () => {
    if (!name.trim() || !value.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await createSecret({ name: name.trim(), value, description: desc.trim() });
      setName('');
      setValue('');
      setDesc('');
      await load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (id: number) => {
    setBusy(true);
    try {
      await deleteSecret(id);
      await load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="anim-fade space-y-5">
      <div className="flex items-center gap-2">
        <Lock size={18} className="text-zinc-400" />
        <h1 className="text-lg font-semibold text-zinc-100">{tr('密钥', 'Secrets')}</h1>
        <button
          type="button"
          onClick={() => void load()}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-zinc-700 px-2 py-1 text-[12px] text-zinc-300 hover:bg-zinc-800"
        >
          <RefreshCw size={13} />
          {tr('刷新', 'Refresh')}
        </button>
      </div>

      <p className="text-[13px] leading-relaxed text-zinc-500">
        {tr(
          '通用凭据库。技能 / 外部 MCP 在各自清单里声明需要哪些密钥名（requires.env），运行时按名匹配注入为环境变量。值只写不读——列表只显示是否已设置。名称用消费方期望的环境变量名（如 TENCENTCLOUD_SECRET_ID、GITHUB_TOKEN）。',
          'Generic credential vault. Skills / external MCP servers declare the secret NAMES they need (requires.env); the runtime injects matching rows as env vars at exec time. Values are write-only — the list only shows whether a value is set. Name a secret with the env var the consumer expects (e.g. TENCENTCLOUD_SECRET_ID, GITHUB_TOKEN).'
        )}
      </p>

      {err && (
        <div className="rounded-md border border-red-900/50 bg-red-950/30 px-3 py-2 text-[12px] text-red-400">{err}</div>
      )}

      {/* add form */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
        <div className="mb-2 text-[12px] font-medium text-zinc-300">{tr('新增密钥', 'Add secret')}</div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_1.2fr_auto]">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={tr('名称 / 环境变量名', 'Name / env var')}
            className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 font-mono text-[12px] text-zinc-200 outline-none focus:border-zinc-600"
          />
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            type="password"
            autoComplete="new-password"
            placeholder={tr('值（写入后不可读）', 'Value (write-only)')}
            className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-[12px] text-zinc-200 outline-none focus:border-zinc-600"
          />
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder={tr('备注（可选）', 'Description (optional)')}
            className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-[12px] text-zinc-200 outline-none focus:border-zinc-600"
          />
          <button
            type="button"
            onClick={() => void onAdd()}
            disabled={busy || !name.trim() || !value.trim()}
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-indigo-500 disabled:opacity-40"
          >
            <Plus size={13} />
            {tr('添加', 'Add')}
          </button>
        </div>
      </div>

      {/* list */}
      <div className="overflow-hidden rounded-lg border border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/40 text-left text-[11px] uppercase tracking-wide text-zinc-500">
              <th className="px-3 py-2 font-medium">{tr('名称', 'Name')}</th>
              <th className="px-3 py-2 font-medium">{tr('备注', 'Description')}</th>
              <th className="px-3 py-2 font-medium">{tr('值', 'Value')}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-[12px] text-zinc-500">
                  {tr('加载中…', 'Loading…')}
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-[12px] text-zinc-600">
                  {tr('还没有密钥。安装需要凭据的技能时在这里填。', 'No secrets yet. Add them here when installing a skill that needs credentials.')}
                </td>
              </tr>
            ) : (
              items.map((s) => <SecretRow key={s.id} s={s} busy={busy} onChanged={load} onDelete={onDelete} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SecretRow({
  s,
  busy,
  onChanged,
  onDelete,
}: {
  s: SecretView;
  busy: boolean;
  onChanged: () => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const { tr } = useI18n();
  const [editing, setEditing] = useState(false);
  const [newVal, setNewVal] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!newVal.trim()) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await updateSecret(s.id, { value: newVal, description: s.description });
      setNewVal('');
      setEditing(false);
      await onChanged();
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr className="border-b border-zinc-800/60 last:border-0">
      <td className="px-3 py-2 font-mono text-[12px] text-zinc-200">{s.name}</td>
      <td className="px-3 py-2 text-[12px] text-zinc-400">{s.description || <span className="text-zinc-600">—</span>}</td>
      <td className="px-3 py-2">
        {editing ? (
          <div className="flex items-center gap-1">
            <input
              value={newVal}
              onChange={(e) => setNewVal(e.target.value)}
              type="password"
              autoComplete="new-password"
              placeholder={tr('新值', 'New value')}
              className="w-40 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-[12px] text-zinc-200 outline-none focus:border-zinc-600"
            />
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="rounded border border-emerald-700 bg-emerald-950/40 p-1 text-emerald-400 hover:bg-emerald-900/40 disabled:opacity-40"
              title={tr('保存', 'Save')}
            >
              <Check size={13} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 text-[12px] text-zinc-400 hover:text-zinc-200"
          >
            <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[11px] text-zinc-500">
              {s.has_value ? '••••••••' : tr('未设置', 'unset')}
            </span>
            <span className="text-[11px] text-indigo-400">{tr('改值', 'edit')}</span>
          </button>
        )}
      </td>
      <td className="px-3 py-2 text-right">
        <button
          type="button"
          onClick={() => void onDelete(s.id)}
          disabled={busy}
          className="rounded border border-zinc-700 p-1 text-zinc-500 hover:border-red-800 hover:text-red-400 disabled:opacity-40"
          title={tr('删除', 'Delete')}
        >
          <Trash2 size={13} />
        </button>
      </td>
    </tr>
  );
}
