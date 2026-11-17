import { Component, useEffect, useRef, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { Scene, reducedMotion } from './Scene3D';
import type { BoardProps } from './types';

class Boundary extends Component<{ onFail: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFail();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default function Board3D(props: BoardProps & { onFail: () => void }) {
  const { onFail, ...board } = props;
  // R3F force-loses the context when the canvas unmounts (e.g. switching to 2D): that is not a failure.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return (
    <Boundary onFail={onFail}>
      <Canvas
        className="board3d"
        shadows="soft"
        dpr={[1, 1.75]}
        frameloop={reducedMotion() ? 'demand' : 'always'}
        camera={{ fov: 36, near: 0.1, far: 500, position: [0, 14, 10] }}
        gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener('webglcontextlost', () => mounted.current && onFail(), { once: true });
        }}
      >
        <Scene {...board} mode="game" />
      </Canvas>
    </Boundary>
  );
}
