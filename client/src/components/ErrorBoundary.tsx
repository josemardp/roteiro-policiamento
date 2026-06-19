import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen p-8 bg-background">
          <div className="flex flex-col items-center w-full max-w-2xl p-8">
            <AlertTriangle
              size={48}
              className="text-destructive mb-6 flex-shrink-0"
            />

            <h2 className="text-xl mb-2 font-bold">Ocorreu um erro inesperado</h2>
            <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">
              Seus roteiros salvos estão preservados. Recarregue a página para
              continuar; se o erro persistir, feche e reabra o aplicativo.
            </p>

            <details className="w-full mb-6">
              <summary className="text-xs text-muted-foreground cursor-pointer mb-2">
                Detalhes técnicos
              </summary>
              <div className="p-4 w-full rounded bg-muted overflow-auto">
                <pre className="text-sm text-muted-foreground whitespace-break-spaces">
                  {this.state.error?.stack}
                </pre>
              </div>
            </details>

            <button
              onClick={() => window.location.reload()}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg",
                "bg-primary text-primary-foreground",
                "hover:opacity-90 cursor-pointer min-h-[44px]"
              )}
            >
              <RotateCcw size={16} />
              Recarregar página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
