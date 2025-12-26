import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from '../App'; // Correct path to App.tsx in root

// Simple Error Boundary to catch crashes and allow reset
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  handleReset = () => {
    // Clear all local storage to fix corrupt data
    localStorage.clear();
    // Reload the page
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4 text-center font-sans">
          <h1 className="text-3xl font-bold mb-4 text-red-500">Something went wrong.</h1>
          <p className="mb-2 text-slate-300">The app encountered a critical error.</p>
          <pre className="bg-slate-800 p-4 rounded-lg text-xs text-left overflow-auto max-w-full mb-6 border border-slate-700">
            {this.state.error?.message || "Unknown error"}
          </pre>
          <button
            onClick={this.handleReset}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-full font-bold transition-colors shadow-lg"
          >
            Reset App & Clear Data
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <HashRouter>
        <App />
      </HashRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
