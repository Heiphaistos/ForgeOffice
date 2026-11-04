// Filet de securite : une erreur de rendu d'un module affiche un ecran francais au lieu d'une page blanche.
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button, Icon } from '@forgeoffice/ui';
import { S } from './strings.ts';

interface Props {
  children: ReactNode;
  onHome: () => void;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ForgeOffice] erreur de rendu', error, info.componentStack);
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    return <ErrorScreen message={error.message} stack={error.stack} onHome={this.props.onHome} />;
  }
}

export function ErrorScreen({ message, stack, onHome }: { message: string; stack?: string; onHome?: () => void }) {
  return (
    <div className="fo-shell-center" role="alert">
      <Icon name="error_circle" size={48} color="var(--fo-danger)" />
      <h1 className="fo-shell-title">{S.error.title}</h1>
      <p className="fo-shell-text">{S.error.body}</p>
      <details className="fo-shell-details">
        <summary>{S.error.details}</summary>
        <pre>{stack ?? message}</pre>
      </details>
      <div className="fo-shell-actions">
        <Button appearance="primary" icon="arrow_clockwise" onClick={() => window.location.reload()}>
          {S.error.reload}
        </Button>
        {onHome && (
          <Button icon="home" onClick={onHome}>
            {S.error.home}
          </Button>
        )}
      </div>
    </div>
  );
}
