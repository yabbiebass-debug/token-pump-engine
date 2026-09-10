import React, { useState } from 'react';

export const TokenImage = ({ src, symbol = 'B', className = '' }) => {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={`rounded-sm bg-purple/20 border border-purple/40 flex items-center justify-center text-purple font-display font-black ${className}`} data-testid="token-image-fallback">
        {symbol.slice(0, 1)}
      </div>
    );
  }
  return <img src={src} alt={symbol} onError={() => setFailed(true)} className={`rounded-sm border border-line object-cover bg-panel2 ${className}`} data-testid="token-image" />;
};
