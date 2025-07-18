import React from 'react';
import { HelpCircle } from 'lucide-react';

interface WelcomeMessageEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}

export const WelcomeMessageEditor: React.FC<WelcomeMessageEditorProps> = ({
  value,
  onChange,
  placeholder,
  rows = 6
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  // Convert newlines to <br> tags for preview
  const getPreviewHtml = () => {
    return value
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('<br />');
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <textarea
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          rows={rows}
          className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors resize-none font-mono text-sm"
        />
        <div className="absolute top-2 right-2 text-neutral-400">
          <HelpCircle className="w-4 h-4" title="Line breaks will be preserved in emails" />
        </div>
      </div>
      
      <div className="text-xs text-neutral-500">
        Tip: Press Enter to create a new line. Each line will appear as a separate paragraph in emails.
      </div>

      {value && (
        <div className="mt-4">
          <p className="text-sm font-medium text-neutral-700 mb-2">Preview:</p>
          <div className="p-4 bg-neutral-50 rounded-lg border border-neutral-200">
            <div 
              className="text-sm text-neutral-700 whitespace-pre-wrap"
              dangerouslySetInnerHTML={{ __html: getPreviewHtml() }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

WelcomeMessageEditor.displayName = 'WelcomeMessageEditor';