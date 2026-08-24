import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { User } from '../types';

const MAX_TWEET_LENGTH = 280;

interface TweetComposerProps {
  currentUser: User;
  onSubmit: (content: string) => void | Promise<void>;
  placeholder?: string;
}

export const TweetComposer: React.FC<TweetComposerProps> = ({
  currentUser,
  onSubmit,
  placeholder = 'بماذا تفكر؟ شارك خاطرة قصيرة...'
}) => {
  const [content, setContent] = useState('');
  const [isPosting, setIsPosting] = useState(false);

  const remaining = MAX_TWEET_LENGTH - content.length;
  const isOverLimit = remaining < 0;
  const canSubmit = content.trim().length > 0 && !isOverLimit && !isPosting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsPosting(true);
    try {
      await onSubmit(content.trim());
      setContent('');
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
      <div className="flex items-start gap-3">
        <img
          src={currentUser.avatarUrl}
          alt={currentUser.fullName}
          referrerPolicy="no-referrer"
          className="w-10 h-10 rounded-full object-cover shrink-0"
        />
        <div className="flex-1 min-w-0 space-y-2">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={placeholder}
            rows={2}
            className="w-full bg-transparent text-sm resize-none outline-hidden placeholder-slate-400 text-slate-900 dark:text-white"
          />
          <div className="flex items-center justify-between">
            <span
              className={`text-[11px] font-mono font-bold ${
                isOverLimit
                  ? 'text-rose-500'
                  : remaining <= 20
                  ? 'text-amber-500'
                  : 'text-slate-400'
              }`}
            >
              {remaining}
            </span>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-all active:scale-95"
            >
              <span>{isPosting ? 'جارٍ النشر...' : 'تغريد'}</span>
              <Send className="w-3.5 h-3.5 rtl:rotate-180" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
