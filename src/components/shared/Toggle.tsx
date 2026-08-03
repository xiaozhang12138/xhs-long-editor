import React from 'react';

interface ToggleProps {
  active: boolean;
  onChange: (active: boolean) => void;
  disabled?: boolean;
}

/** iOS-style toggle switch component */
export const Toggle: React.FC<ToggleProps> = ({ active, onChange, disabled = false }) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      className={`toggle-switch ${active ? 'active' : ''}`}
      onClick={() => !disabled && onChange(!active)}
      disabled={disabled}
    />
  );
};
