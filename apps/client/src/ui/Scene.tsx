import { Component, Suspense, lazy, useState, type ReactNode } from 'react';
import type { ThemeDef } from '../themes';
import { webglAvailable } from '../board/types';

// The orbiting island diorama; a separate chunk so the home screen paints before three.js arrives.
const Showcase = lazy(() => import('../board/Showcase'));

class Boundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * Full-bleed backdrop for home and lobby. The painted dusk + star lattice is always underneath, so there is
 * no layout shift and nothing is lost when WebGL is missing or the 3D scene fails.
 */
export function SceneBackdrop({ theme, dim }: { theme: ThemeDef; dim?: boolean }) {
  const [can3d] = useState(() => webglAvailable());
  const [failed, setFailed] = useState(false);
  return (
    <div className={`scene${dim ? ' dim' : ''}`} aria-hidden>
      <div className="scene-paint" />
      {can3d && !failed && (
        <Boundary onError={() => setFailed(true)}>
          <Suspense fallback={null}>
            <div className="scene-3d">
              <Showcase theme={theme} />
            </div>
          </Suspense>
        </Boundary>
      )}
      <div className="scene-veil" />
    </div>
  );
}
