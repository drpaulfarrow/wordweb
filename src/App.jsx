import React, { useState } from 'react';
import MindMap from './components/MindMap';
import AccessibilityAnnouncer from './components/AccessibilityAnnouncer';

function App() {
  const [announce, setAnnounce] = useState('Ready');

  return (
    <div className="app-shell">
      <header className="header">
        <div className="brand">
          <svg className="brain" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <path fill="#7c6cff" d="M22 8c-5 0-9 4-9 9v1c-3 2-5 5-5 9 0 3 1 6 4 8-1 1-1 2-1 3 0 4 3 7 7 7h4c3 0 6-3 6-6v-1h1c4 0 7-3 7-7V22c0-8-6-14-14-14z"/>
            <path fill="#a68cff" d="M42 10c6 0 11 5 11 11 3 1 5 5 5 8 0 4-2 7-6 9 0 5-4 9-9 9h-5c-4 0-7-3-7-7v-1h-1c-3 0-6-3-6-6V25c0-8 8-15 18-15z"/>
          </svg>
          <span>WordWeb</span>
        </div>
      </header>
      <AccessibilityAnnouncer message={announce} />
      <main className="canvas-wrap">
        <MindMap onAnnounce={(msg) => setAnnounce(msg)} />
      </main>
    </div>
  );
}

export default App;
