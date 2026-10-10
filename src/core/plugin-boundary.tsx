"use client";

import { Component, type ReactNode } from "react";

/** Client render failures stay local; plugins own async failure/cleanup. */
export class PluginBoundary extends Component<
  { children: ReactNode; name: string },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div role="status">
        <p>{this.props.name} is temporarily unavailable.</p>
        <button type="button" onClick={() => this.setState({ failed: false })}>
          Retry {this.props.name}
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
