import { Component, type ReactNode } from 'react';
import { isStaleBuildError, reloadForNewBuild } from '@/lib/staleBuild';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    if (isStaleBuildError(error)) reloadForNewBuild(); // the site was updated while this tab was open
  }

  render() {
    if (this.state.error) {
      const stale = isStaleBuildError(this.state.error);
      return (
        <div className="m-6 rounded-lg border border-destructive/30 bg-destructive/10 p-6">
          <h2 className="text-lg font-semibold text-destructive">{stale ? 'Dashtor was updated' : 'Something went wrong'}</h2>
          <pre className="mt-2 whitespace-pre-wrap text-sm text-destructive">
            {stale ? 'A new version is available. Reloading to get it…' : this.state.error.message}
          </pre>
          <button
            className="mt-4 rounded-md bg-destructive px-3 py-1.5 text-sm text-white hover:bg-destructive/90"
            onClick={() => (stale ? window.location.reload() : this.setState({ error: null }))}
          >
            {stale ? 'Reload now' : 'Try again'}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
