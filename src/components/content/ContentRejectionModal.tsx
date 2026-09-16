/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AlertTriangle, XCircle, FileWarning } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface ContentRejectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  contentTitle: string;
  versionNumber: number;
  onConfirmReject: (reason: string) => Promise<void>;
  isProcessing: boolean;
}

export const ContentRejectionModal: React.FC<ContentRejectionModalProps> = ({
  isOpen,
  onClose,
  contentTitle,
  versionNumber,
  onConfirmReject,
  isProcessing,
}) => {
  const [reason, setReason] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = reason.trim();
    if (!trimmed) {
      setValidationError('La justificación del rechazo es estrictamente obligatoria y no puede estar vacía.');
      return;
    }
    if (trimmed.length < 10) {
      setValidationError('Por favor, proporcione una justificación detallada con al menos 10 caracteres para orientar la revisión.');
      return;
    }

    setValidationError(null);
    await onConfirmReject(trimmed);
    setReason('');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Rechazar pieza de contenido" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-amber-200">Revisión humana obligatoria: </span>
            El rechazo formal bloquea la publicación de la versión #{versionNumber} y exige una justificación clara para que el autor pueda elaborar una revisión fundamentada.
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Justificación del rechazo <span className="text-rose-400">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (validationError) setValidationError(null);
            }}
            rows={4}
            placeholder="Describa detalladamente qué debe ajustarse (ej: tono de voz, adecuación regulatoria, mensajes clave ausentes, formato)..."
            className="w-full bg-[#161f30] border border-[#26344d] rounded-lg px-3 py-2.5 text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-rose-500 transition-colors"
          />
          <div className="flex justify-between items-center mt-1 text-[11px] text-slate-500">
            <span>Mínimo 10 caracteres</span>
            <span>{reason.trim().length} caracteres</span>
          </div>
          {validationError && (
            <p className="text-rose-400 text-xs mt-1.5 flex items-center gap-1">
              <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
              {validationError}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#202b42]">
          <Button variant="ghost" size="sm" type="button" onClick={onClose} disabled={isProcessing}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            size="sm"
            type="submit"
            disabled={!reason.trim() || reason.trim().length < 10 || isProcessing}
            isLoading={isProcessing}
            leftIcon={<FileWarning className="w-4 h-4" />}
          >
            Confirmar rechazo
          </Button>
        </div>
      </form>
    </Modal>
  );
};
