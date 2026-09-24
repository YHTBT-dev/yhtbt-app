"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { label: string; children: ReactNode };
type State = { hasError: boolean };

// Logs the real error (message, stack, and React's component stack) to the
// console and shows a visible message, instead of a failed render
// degrading invisibly. Only catches errors thrown while rendering its
// child components (and their effects/lifecycles), not code running
// inline in the parent component that renders it.
export default class RenderErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[RenderErrorBoundary:${this.props.label}]`, {
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mt-8 border border-red-600/40 p-6 text-sm text-red-600">
          Something went wrong displaying this section. Details are in the
          browser console.
        </div>
      );
    }
    return this.props.children;
  }
}
