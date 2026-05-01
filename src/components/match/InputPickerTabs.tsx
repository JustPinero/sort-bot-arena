import { useState } from 'react';

import { ApiError } from '@/api/client';
import { useUploadInput } from '@/api/queries';
import type { InputSummary } from '@/api/types';
import { LoadingGear } from '@/components/LoadingGear';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

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
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <TabsTrigger value="preset">Preset</TabsTrigger>
            </span>
          </TooltipTrigger>
          <TooltipContent>Server picks N bundled inputs by weight class.</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <TabsTrigger value="manual">Manual</TabsTrigger>
            </span>
          </TooltipTrigger>
          <TooltipContent>Cherry-pick exact inputs from the shared pool.</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <TabsTrigger value="upload">Upload</TabsTrigger>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            Add a new integer array; saved globally for everyone to use.
          </TooltipContent>
        </Tooltip>
      </TabsList>

      <TabsContent value="preset">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-xs uppercase tracking-wide text-text-secondary">
            Preset bundle
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
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
            </TooltipTrigger>
            <TooltipContent>
              Bigger bundle = longer fight + heavier weight class chip.
            </TooltipContent>
          </Tooltip>
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
      <div className="flex flex-col gap-1">
        <label
          htmlFor="upload-values"
          className="font-mono text-xs uppercase tracking-wide text-text-secondary"
        >
          Values
        </label>
        <Tooltip>
          <TooltipTrigger asChild>
            <textarea
              id="upload-values"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              rows={4}
              className="rounded-sm border bg-surface-2 px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-hazard"
              placeholder="1, 5, 3, 8, 2"
            />
          </TooltipTrigger>
          <TooltipContent>Integers only. Negatives ok. Max 50,000 per input.</TooltipContent>
        </Tooltip>
        <span className="mt-1 font-mono text-[11px] uppercase tracking-wide text-text-tertiary">
          Cap: 50,000 integers per upload.
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="upload-format"
            className="font-mono text-xs uppercase tracking-wide text-text-secondary"
          >
            Format
          </label>
          <Tooltip>
            <TooltipTrigger asChild>
              <select
                id="upload-format"
                value={format}
                onChange={(e) => setFormat(e.target.value as typeof format)}
                className="rounded-sm border bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-hazard"
              >
                <option value="comma">Comma-separated</option>
                <option value="space">Space-separated</option>
                <option value="newline">One per line</option>
              </select>
            </TooltipTrigger>
            <TooltipContent>How values are separated in the textarea above.</TooltipContent>
          </Tooltip>
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="upload-name"
            className="font-mono text-xs uppercase tracking-wide text-text-secondary"
          >
            Name (optional)
          </label>
          <Tooltip>
            <TooltipTrigger asChild>
              <input
                id="upload-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-sm border bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-hazard"
                placeholder="My pathological input"
              />
            </TooltipTrigger>
            <TooltipContent>
              Shown in the manual tab. Leave blank for an auto-generated label.
            </TooltipContent>
          </Tooltip>
        </div>
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
          className="inline-flex h-8 items-center gap-2 rounded-sm bg-hazard px-3 font-mono text-xs font-bold uppercase tracking-wide text-black hover:opacity-90 disabled:opacity-50"
        >
          {upload.isPending ? (
            <>
              <LoadingGear size="h-3 w-3" className="!py-0" />
              <span>Uploading</span>
            </>
          ) : (
            'Add input'
          )}
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
