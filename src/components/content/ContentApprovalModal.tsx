/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface ContentApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  contentTitle: string;
  versionNumber: number;
  onConfirmApprove: (comment?: string) => Promise<void>;
  isProcessing: boolean;
}

export const ContentApprovalModal: React.FC<ContentApprovalModalProps> = ({
  isOpen,
  onClose,
  contentTitle,
  versionNumber,
  onConfirmApprove,
  isProcessing,
}) => {
  const [comment, setComment] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onConfirmApprove(comment.trim() || undefined);
    setComment('');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Aprovar peça de conteúdo" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-start gap-2.5">
          <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-emerald-200">Decisão formal de aprovação: </span>
            Ao aprovar a versão #{versionNumber} de &ldquo;{contentTitle}&rdquo;, certifica que a peça foi revista por um humano, cumpre os requisitos normativos da campanha e fica autorizada para distribuição.
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Nota de aprovação (Opcional)
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder="Adicione indicações finais de distribuição ou observações para a equipa criativa..."
            className="w-full bg-[#161f30] border border-[#26344d] rounded-lg px-3 py-2.5 text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#202b42]">
          <Button variant="ghost" size="sm" type="button" onClick={onClose} disabled={isProcessing}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="sm"
            type="submit"
            disabled={isProcessing}
            isLoading={isProcessing}
            leftIcon={<CheckCircle2 className="w-4 h-4" />}
          >
            Confirmar aprovação
          </Button>
        </div>
      </form>
    </Modal>
  );
};
