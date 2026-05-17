'use client';

import { useEffect, useState } from 'react';
import DevtoolsPanel from './DevtoolsPanel';

export type DevtoolsProps = {
  apiBase?: string;
  endpoint?: string;
  standaloneUrl?: string;
  /** Set to true to show in production as well. Default: false */
  showInProduction?: boolean;
};

export default function Devtools(props: DevtoolsProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!props.showInProduction && process.env.NODE_ENV === 'production') return null;
  if (!mounted) return null;
  return <DevtoolsPanel {...props} />;
}
