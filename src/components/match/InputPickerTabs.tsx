import { useState } from 'react';

import { ApiError } from '@/api/client';
import { useUploadInput } from '@/api/queries';
import type { InputSummary } from '@/api/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export type PresetKey = 'sparring' | 'exhibition' | 'title_fight';

const PRESET_COUNTS: Record<PresetKey, number> = {
  sparring: 3,
  exhibition: 5,
  title_fight: 57,
};

const PRESET_LABELS: Record<PresetKey, string> = {
  sparring: 'Sparring (3 small)',
  exhibition: 'Exhibition (5 mixed)',
  title_fight: 'Title Fight (full 57)',
};

interface InputPickerTabsProps {
  inputs: InputSummary[];
  preset: PresetKey;
  onChangePreset: (p: PresetKey) => void;
  selectedInputIds: Set<string>;
  onToggleInput: (id: string) => void;
  activeTab: 'preset' | 'manual' | 'upload';
  onChangeTab: (t: 'preset' | 'manual' | 'upload') => void;
  onInputUploaded: (input: InputSummary) => void;
}

export function InputPickerTabs({
  inputs,
  preset,
  onChangePreset,
  selectedInputIds,
  onToggleInput,
  activeTab,
  onChangeTab,
  onInputUploaded,
}: InputPickerTabsProps) {
  return (
    <Tabs value={activeTab} onValueChange={(v) => onChangeTab(v as typeof activeTab)}>
      <TabsList>
        <TabsTrigger value="preset">Preset</TabsTrigger>
        <TabsTrigger value="manual">Manual</TabsTrigger>
        <TabsTrigger value="upload">Upload</TabsTrigger>
      </TabsList>

      <TabsContent value="preset">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-xs uppercase tracking-wide text-text-secondary">
            Preset bundle
          </span>
          <select
            value={preset}
            onChange={(e) => onChangePreset(e.target.value as PresetKey)}
            className="rounded-sm border bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-hazard"
          >
            {(Object.keys(PRESET_LABELS) as PresetKey[]).map((k) => (
              <option key={k} value={k}>
                {PRESET_LABELS[k]}
              </option>
            ))}
          </select>
          <span className="mt-1 font-mono text-xs uppercase tracking-wide text-text-tertiary">
            Server selects {PRESET_COUNTS[preset]} input
            {PRESET_COUNTS[preset] === 1 ? '' : 's'}
          </span>
        </label>
      </TabsContent>

      <TabsContent value="manual">
        {inputs.length === 0 ? (
          <p className="text-sm text-text-tertiary">No inputs available yet.</p>
        ) : (
          <ul className="max-h-64 overflow-y-auto rounded-sm border bg-surface-2 p-2">
            {inputs.map((inp) => {
              const checked = selectedInputIds.has(inp.id);
              return (
                <li key={inp.id} className="flex items-center gap-2 px-2 py-1">
                  <input
                    id={`input-${inp.id}`}
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleInput(inp.id)}
                    aria-label={inp.name}
                  />
                  <label
                    htmlFor={`input-${inp.id}`}
                    className="flex-1 cursor-pointer font-mono text-xs text-text-secondary"
                  >
                    {inp.name}
                    <span className="ml-2 text-text-tertiary">size {inp.size}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </TabsContent>

      <TabsContent value="upload">
        <UploadForm onUploaded={onInputUploaded} />
      </TabsContent>
    </Tabs>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function presetCount(p: PresetKey): number {
  return PRESET_COUNTS[p];
}

interface UploadFormProps {
  onUploaded: (input: InputSummary) => void;
}

function UploadForm({ onUploaded }: UploadFormProps) {
  const [raw, setRaw] = useState('');
  const [format, setFormat] = useState<'comma' | 'space' | 'newline'>('comma');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const upload = useUploadInput();

  const onSubmit = async () => {
    setError(null);
    const parsed = parseValues(raw, format);
    if ('error' in parsed) {
      setError(parsed.error);
      return;
    }
    if (parsed.values.length === 0) {
      setError('Provide at least one integer.');
      return;
    }
    if (parsed.values.length > 50_000) {
      setError('Max 50,000 integers per input.');
      return;
    }
    try {
      const result = await upload.mutateAsync({
        values: parsed.values,
        format,
        ...(name.trim() ? { display_name: name.trim() } : {}),
      });
      onUploaded(result);
      setRaw('');
      setName('');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || `Upload failed (${err.status})`);
      } else {
        setError('Upload failed. Try again.');
      }
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="font-mono text-xs uppercase tracking-wide text-text-secondary">
          Values
        </span>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={4}
          className="rounded-sm border bg-surface-2 px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-hazard"
          placeholder="1, 5, 3, 8, 2"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-xs uppercase tracking-wide text-text-secondary">
            Format
          </span>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as typeof format)}
            className="rounded-sm border bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-hazard"
          >
            <option value="comma">Comma-separated</option>
            <option value="space">Space-separated</option>
            <option value="newline">One per line</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-mono text-xs uppercase tracking-wide text-text-secondary">
            Name (optional)
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-sm border bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-hazard"
            placeholder="My pathological input"
          />
        </label>
      </div>

      {error ? (
        <p role="alert" className="rounded-sm bg-hazard/10 px-3 py-2 text-sm text-hazard">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onSubmit}
          disabled={upload.isPending}
          className="inline-flex h-8 items-center rounded-sm bg-hazard px-3 font-mono text-xs font-bold uppercase tracking-wide text-black hover:opacity-90 disabled:opacity-50"
        >
          {upload.isPending ? 'Uploading…' : 'Add input'}
        </button>
      </div>
    </div>
  );
}

type ParseResult = { values: number[] } | { error: string };

// eslint-disable-next-line react-refresh/only-export-components
export function parseValues(raw: string, format: 'comma' | 'space' | 'newline'): ParseResult {
  const trimmed = raw.trim();
  if (!trimmed) return { values: [] };
  const sep = format === 'comma' ? /\s*,\s*/ : format === 'space' ? /\s+/ : /\r?\n/;
  const parts = trimmed.split(sep).map((s) => s.trim()).filter(Boolean);
  const out: number[] = [];
  for (const p of parts) {
    if (!/^-?\d+$/.test(p)) {
      return { error: 'Values must be integers (negatives ok).' };
    }
    const n = Number(p);
    if (!Number.isInteger(n)) {
      return { error: 'Values must be integers (negatives ok).' };
    }
    out.push(n);
  }
  return { values: out };
}
