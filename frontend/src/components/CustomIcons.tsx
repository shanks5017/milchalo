import React from 'react';

export const CustomTrain = ({ className = "" }: { className?: string }) => (
  <span 
    className={`inline-block bg-current ${className}`}
    style={{
      maskImage: 'url(/train.png)',
      WebkitMaskImage: 'url(/train.png)',
      maskSize: 'contain',
      maskRepeat: 'no-repeat',
      maskPosition: 'center'
    }}
  />
);

export const CustomBus = ({ className = "" }: { className?: string }) => (
  <span 
    className={`inline-block bg-current ${className}`}
    style={{
      maskImage: 'url(/bus.png)',
      WebkitMaskImage: 'url(/bus.png)',
      maskSize: 'contain',
      maskRepeat: 'no-repeat',
      maskPosition: 'center'
    }}
  />
);
