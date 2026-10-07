import type { ReactNode } from 'react';
import type { ApiState } from '@/hooks/useApi';
import { ErrorBanner } from './ErrorBanner';
import { Loading } from './Loading';

/**
 * Render the right thing for a `useApi` result: spinner while loading, an error banner on failure,
 * otherwise the children with the data. One place for loading/error UI instead of one per page.
 *
 *   <AsyncView state={useApi<Item[]>('/items')}>{(items) => <List items={items} />}</AsyncView>
 */
export function AsyncView<T>({ state, children, loadingLabel }: {
  state: ApiState<T>;
  children: (data: T) => ReactNode;
  loadingLabel?: string;
}) {
  if (state.data !== null) {
    return (
      <>
        {state.error && <ErrorBanner message={state.error} />}
        {children(state.data)}
      </>
    );
  }
  if (state.error) return <ErrorBanner message={state.error} />;
  if (state.loading) return <Loading label={loadingLabel} />;
  return null;
}
