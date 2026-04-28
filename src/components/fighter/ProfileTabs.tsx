import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/cn';

import type { ReactNode } from 'react';

export type ProfileTabKey = 'history' | 'performance' | 'scouting' | 'achievements';

interface ProfileTab {
  key: ProfileTabKey;
  label: string;
  content: ReactNode;
}

interface ProfileTabsProps {
  tabs: ProfileTab[];
  defaultTab?: ProfileTabKey;
  paramName?: string;
  className?: string;
}

export function ProfileTabs({
  tabs,
  defaultTab = 'history',
  paramName = 'tab',
  className,
}: ProfileTabsProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const param = searchParams.get(paramName) as ProfileTabKey | null;
  const valid = tabs.find((t) => t.key === param)?.key ?? defaultTab;

  const onChange = useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams);
      params.set(paramName, next);
      setSearchParams(params, { replace: true });
    },
    [paramName, searchParams, setSearchParams],
  );

  return (
    <Tabs value={valid} onValueChange={onChange} className={cn('w-full', className)}>
      <TabsList>
        {tabs.map((t) => (
          <TabsTrigger key={t.key} value={t.key}>
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((t) => (
        <TabsContent key={t.key} value={t.key}>
          {t.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
