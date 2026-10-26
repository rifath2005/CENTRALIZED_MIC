import React, { forwardRef, useState } from 'react';

export interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  error?: string;
  touched?: boolean;
  leftIcon?: string; // Material symbol icon name or SVG
  rightAction?: React.ReactNode;
  hint?: string;
  isPassword?: boolean;
}

export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  (
    {
      id,
      label,
      error,
      touched,
      leftIcon,
      rightAction,
      hint,
      isPassword = false,
      type = 'text',
      disabled,
      className = '',
      value,
      onChange,
      onBlur,
      ...rest
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const hasError = Boolean(touched && error);
    const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

    return (
      <div className="flex flex-col gap-1 w-full text-left">
        {/* Label */}
        <div className="flex items-center justify-between">
          <label
            htmlFor={id}
            className={`text-xs font-semibold tracking-wide transition-colors ${
              hasError
                ? 'text-red-600 dark:text-red-400'
                : 'text-slate-700 dark:text-slate-200'
            }`}
          >
            {label}
            {rest.required && <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>}
          </label>
          {hint && !hasError && (
            <span className="text-[11px] text-slate-400 dark:text-slate-500">{hint}</span>
          )}
        </div>

        {/* Input Wrapper */}
        <div className="relative flex items-center">
          {/* Left Icon */}
          {leftIcon && (
            <div
              className={`absolute left-3.5 flex items-center pointer-events-none transition-colors ${
                hasError
                  ? 'text-red-500 dark:text-red-400'
                  : 'text-slate-400 dark:text-slate-500 peer-focus:text-red-500'
              }`}
              aria-hidden="true"
            >
              <span className="material-symbols-outlined text-[20px]">{leftIcon}</span>
            </div>
          )}

          {/* Actual Input */}
          <input
            ref={ref}
            id={id}
            name={id}
            type={inputType}
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            disabled={disabled}
            aria-invalid={hasError ? 'true' : 'false'}
            aria-describedby={hasError ? `${id}-error` : undefined}
            className={`
              w-full h-11 md:h-12 text-sm rounded-xl transition-all duration-150 outline-none
              bg-white dark:bg-slate-900/90 text-slate-900 dark:text-white
              placeholder:text-slate-400 dark:placeholder:text-slate-500
              ${leftIcon ? 'pl-11' : 'pl-3.5'}
              ${isPassword || rightAction ? 'pr-11' : 'pr-3.5'}
              border
              ${
                hasError
                  ? 'border-red-500 dark:border-red-500 ring-2 ring-red-500/20 dark:ring-red-500/30'
                  : 'border-slate-300 dark:border-slate-700/80 hover:border-slate-400 dark:hover:border-slate-600 focus:border-red-500 dark:focus:border-red-500 focus:ring-2 focus:ring-red-500/20'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-800' : ''}
              ${className}
            `}
            {...rest}
          />

          {/* Right Action (e.g. Password Toggle or custom action) */}
          {isPassword ? (
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              tabIndex={0}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-2.5 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500/40"
            >
              <span className="material-symbols-outlined text-[20px]">
                {showPassword ? 'visibility_off' : 'visibility'}
              </span>
            </button>
          ) : (
            rightAction && (
              <div className="absolute right-3 flex items-center">
                {rightAction}
              </div>
            )
          )}
        </div>

        {/* Error message below field */}
        {hasError && (
          <div
            id={`${id}-error`}
            role="alert"
            className="flex items-center gap-1.5 mt-0.5 text-xs text-red-600 dark:text-red-400 animate-fadeIn"
          >
            <span className="material-symbols-outlined text-[16px] flex-shrink-0" aria-hidden="true">
              error
            </span>
            <span>{error}</span>
          </div>
        )}
      </div>
    );
  }
);

FormInput.displayName = 'FormInput';
