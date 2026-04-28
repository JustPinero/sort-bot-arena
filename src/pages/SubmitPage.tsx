import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { useSubmitBot } from '@/api/queries';
import type { EvaluationEvent } from '@/api/types';
import { DebutEvaluation } from '@/components/submit/DebutEvaluation';
import { MonacoEditor } from '@/components/submit/MonacoEditor';
import { LANGUAGE_TEMPLATES } from '@/components/submit/templates';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { playMockEvaluation } from '@/lib/playMockEvaluation';

type Language = 'python' | 'node' | 'go' | 'binary';

const LANGUAGE_LABEL: Record<Language, string> = {
  python: 'Lightweight (Python)',
  node: 'Middleweight (Node)',
  go: 'Cruiserweight (Go)',
  binary: 'Heavyweight (Binary)',
};

const formSchema = z.object({
  display_name: z.string().min(1, 'Pick a fighter name').max(40, 'Keep it under 40 chars'),
  language: z.enum(['python', 'node', 'go', 'binary']),
  source: z.string().min(10, 'Source must be at least 10 characters'),
});
type FormValues = z.infer<typeof formSchema>;

export default function SubmitPage() {
  const submitBot = useSubmitBot();
  const [debutBotId, setDebutBotId] = useState<string | null>(null);
  const [events, setEvents] = useState<EvaluationEvent[]>([]);
  const handleRef = useRef<{ cancel: () => void } | null>(null);

  const {
    control,
    handleSubmit,
    register,
    setValue,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      display_name: '',
      language: 'python',
      source: LANGUAGE_TEMPLATES.python.source,
    },
  });

  const language = watch('language');
  const monacoLanguage = useMemo(() => LANGUAGE_TEMPLATES[language].language, [language]);

  useEffect(() => {
    return () => handleRef.current?.cancel();
  }, []);

  const onLanguageChange = (next: Language) => {
    setValue('language', next, { shouldDirty: true });
    setValue('source', LANGUAGE_TEMPLATES[next].source, { shouldDirty: true });
  };

  const onSubmit = handleSubmit(async (values) => {
    try {
      const res = await submitBot.mutateAsync({
        display_name: values.display_name,
        language: values.language,
        source: values.source,
        filename: LANGUAGE_TEMPLATES[values.language].filename,
      });
      setEvents([]);
      handleRef.current = playMockEvaluation({
        botId: res.bot_id,
        speedMs: 350,
        onEvent: (e) => setEvents((prev) => [...prev, e]),
      });
      setDebutBotId(res.bot_id);
    } catch (err) {
      const apiErr = err as {
        fields?: Array<{ path: string; message: string }>;
        message?: string;
      };
      if (apiErr.fields) {
        for (const f of apiErr.fields) {
          if (f.path === 'display_name' || f.path === 'source' || f.path === 'language') {
            setError(f.path as keyof FormValues, { message: f.message });
          }
        }
      } else if (apiErr.message) {
        setError('root', { message: apiErr.message });
      }
    }
  });

  if (debutBotId) {
    return <DebutEvaluation botId={debutBotId} events={events} />;
  }

  return (
    <section className="mx-auto max-w-3xl px-4 py-8">
      <header className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-text-tertiary">Submit</p>
          <h1 className="mt-2 font-display text-4xl uppercase tracking-wide">
            Register Your Fighter
          </h1>
        </div>
        <Badge variant="hazard">Bot Contract</Badge>
      </header>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-6">
        <div>
          <label
            htmlFor="display_name"
            className="font-mono text-xs uppercase tracking-widest text-text-secondary"
          >
            Fighter Name
          </label>
          <input
            id="display_name"
            {...register('display_name')}
            className={cn(
              'mt-2 h-10 w-full rounded-md border bg-surface-1 px-3 text-text-primary',
              errors.display_name && 'border-combat',
            )}
            placeholder="e.g. The Pivot"
            aria-invalid={Boolean(errors.display_name)}
            aria-describedby={errors.display_name ? 'display_name-error' : undefined}
          />
          {errors.display_name ? (
            <p id="display_name-error" className="mt-2 text-xs text-combat">
              {errors.display_name.message}
            </p>
          ) : null}
        </div>

        <fieldset>
          <legend className="font-mono text-xs uppercase tracking-widest text-text-secondary">
            Weight Class
          </legend>
          <Controller
            control={control}
            name="language"
            render={({ field }) => (
              <div className="mt-2 flex flex-wrap gap-2">
                {(Object.keys(LANGUAGE_LABEL) as Language[]).map((lang) => {
                  const active = field.value === lang;
                  return (
                    <button
                      key={lang}
                      type="button"
                      aria-pressed={active}
                      onClick={() => onLanguageChange(lang)}
                      className={cn(
                        'inline-flex h-9 items-center rounded-sm px-3 font-mono text-xs font-bold uppercase tracking-wide transition-colors duration-snap',
                        active
                          ? 'bg-hazard text-surface-0'
                          : 'bg-surface-2 text-text-secondary hover:bg-surface-3 hover:text-text-primary',
                      )}
                    >
                      {LANGUAGE_LABEL[lang]}
                    </button>
                  );
                })}
              </div>
            )}
          />
        </fieldset>

        <div>
          <label
            htmlFor="source"
            className="font-mono text-xs uppercase tracking-widest text-text-secondary"
          >
            Source
          </label>
          <Controller
            control={control}
            name="source"
            render={({ field }) => (
              <MonacoEditor
                value={field.value}
                language={monacoLanguage}
                onChange={field.onChange}
              />
            )}
          />
          {errors.source ? (
            <p className="mt-2 text-xs text-combat">{errors.source.message}</p>
          ) : null}
        </div>

        {errors.root ? (
          <p className="rounded-md border border-combat bg-combat-bg p-3 text-combat">
            {errors.root.message}
          </p>
        ) : null}

        <Button type="submit" variant="combat" disabled={isSubmitting}>
          {isSubmitting ? 'Submitting…' : 'Test Sparring'}
        </Button>
      </form>
    </section>
  );
}
