import { Component, type ReactNode } from 'react';

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

  render() {
    if (this.state.error) {
      return (
        <div className="m-6 rounded-lg border border-destructive/30 bg-destructive/10 p-6">
          <h2 className="text-lg font-semibold text-destructive">Something went wrong</h2>
          <pre className="mt-2 whitespace-pre-wrap text-sm text-destructive">
            {this.state.error.message}
          </pre>
          <button
            className="mt-4 rounded-md bg-destructive px-3 py-1.5 text-sm text-white hover:bg-destructive/90"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
