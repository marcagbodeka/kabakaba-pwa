import { useState } from 'react';
import { IconEye } from './icons';

export default function VendorInput({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  prefix,
  password = false,
  inputMode,
  maxLength,
  autoComplete,
}) {
  const [obscure, setObscure] = useState(password);

  return (
    <div className="field">
      {label ? <label>{label}</label> : null}
      <div className="input-shell">
        {prefix ? <span className="prefix">{prefix}</span> : null}
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          type={password && obscure ? 'password' : type}
          inputMode={inputMode}
          maxLength={maxLength}
          autoComplete={autoComplete}
        />
        {password ? (
          <button
            type="button"
            className="eye"
            onClick={() => setObscure((v) => !v)}
            aria-label={obscure ? 'Afficher' : 'Masquer'}
          >
            <IconEye off={!obscure} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
