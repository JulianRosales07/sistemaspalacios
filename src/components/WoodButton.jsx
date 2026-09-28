import React from 'react';
import { sfx } from '../game/audio';

export default function WoodButton({
  children,
  onClick,
  color = 't-teal',
  chica = false,
  rotation = 0,
  disabled = false,
  className = '',
  id,
  type = 'button',
  ...rest
}) {
  const handleClick = (e) => {
    if (disabled) return;
    sfx.clic();
    if (onClick) onClick(e);
  };

  const style = rotation ? { '--r': `${rotation}deg` } : undefined;
  const classes = `tabla ${color} ${chica ? 'chica' : ''} ${className}`.trim();

  return (
    <button
      id={id}
      type={type}
      className={classes}
      onClick={handleClick}
      disabled={disabled}
      style={style}
      {...rest}
    >
      {children}
    </button>
  );
}
