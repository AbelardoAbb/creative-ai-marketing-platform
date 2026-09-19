import React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from './Button';

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Ocorreu um erro',
  message,
  onRetry,
  className = '',
}) => {
  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center p-6 text-center rounded-xl bg-red-50 border border-red-200 text-slate-800 ${className}`}
    >
      <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 mb-3">
        <AlertCircle className="w-5 h-5" />
      </div>
      <h4 className="text-sm font-semibold text-red-900">{title}</h4>
      <p className="text-xs text-red-700 mt-1 max-w-md leading-relaxed">{message}</p>
      {onRetry && (
        <div className="mt-4">
          <Button size="sm" variant="outline" leftIcon={<RotateCcw className="w-3.5 h-3.5" />} onClick={onRetry}>
            Tentar novamente
          </Button>
        </div>
      )}
    </div>
  );
};
