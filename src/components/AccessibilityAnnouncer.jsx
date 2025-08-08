import React from 'react';

export default function AccessibilityAnnouncer({ message }) {
  return (
    <div aria-live="polite" aria-atomic="true" style={{ position: 'absolute', left: -9999 }}>
      {message}
    </div>
  );
}