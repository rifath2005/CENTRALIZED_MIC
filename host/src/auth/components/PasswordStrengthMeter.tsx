import React from 'react';
import { PasswordStrength } from '../types';

interface PasswordStrengthMeterProps {
  strength: PasswordStrength;
  password: string;
}

export const PasswordStrengthMeter: React.FC<PasswordStrengthMeterProps> = ({
  strength,
  password,
}) => {
  if (!password) {
    return null;
  }

  const { score, label, color, requirements } = strength;

  const checklistItems = [
    { label: '8+ characters', met: requirements.minLength },
    { label: 'At least 1 uppercase letter', met: requirements.hasUppercase },
    { label: 'At least 1 number', met: requirements.hasNumber },
    { label: 'At least 1 special character', met: requirements.hasSpecialChar },
  ];

  return (
    <div className="flex flex-col gap-2 mt-1.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 transition-all text-left">
      {/* Strength Bar & Label Header */}
      <div className="flex items-center justify-between text-xs font-medium">
        <span className="text-slate-500 dark:text-slate-400">Password strength:</span>
        <span className={`font-semibold ${color}`}>{label}</span>
      </div>

      {/* 4-Segment Progress Bar */}
      <div className="grid grid-cols-4 gap-1.5 h-1.5 w-full">
        {[1, 2, 3, 4].map((step) => {
          let segmentBg = 'bg-slate-200 dark:bg-slate-800';
          if (score >= step) {
            if (score <= 1) segmentBg = 'bg-red-500';
            else if (score === 2) segmentBg = 'bg-amber-500';
            else if (score === 3) segmentBg = 'bg-blue-500';
            else segmentBg = 'bg-emerald-500';
          }
          return (
            <div
              key={step}
              className={`h-full rounded-full transition-all duration-300 ${segmentBg}`}
            />
          );
        })}
      </div>

      {/* Requirement Checklist */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-1 pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
        {checklistItems.map((item, index) => (
          <div
            key={index}
            className={`flex items-center gap-1.5 text-xs transition-colors ${
              item.met
                ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                : 'text-slate-400 dark:text-slate-500'
            }`}
          >
            <span
              className={`material-symbols-outlined text-[16px] flex-shrink-0 ${
                item.met ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
              }`}
              aria-hidden="true"
            >
              {item.met ? 'check_circle' : 'radio_button_unchecked'}
            </span>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
