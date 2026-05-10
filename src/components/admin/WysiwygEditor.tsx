import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Bold, Italic, Underline, List, Link, Image, Code, Save } from 'lucide-react';
import { sanitizeMarkdown, createSafeHtml } from '@/utils/xssProtection';

interface WysiwygEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const WysiwygEditor: React.FC<WysiwygEditorProps> = ({ 
  value, 
  onChange, 
  placeholder = "Start writing..." 
}) => {
  const { toast } = useToast();
  const [isPreview, setIsPreview] = useState(false);

  const insertMarkdown = (syntax: string, placeholder: string = '') => {
    const textarea = document.getElementById('wysiwyg-content') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = value.substring(start, end) || placeholder;
      
      let newText = '';
      switch (syntax) {
        case 'bold':
          newText = `**${selectedText}**`;
          break;
        case 'italic':
          newText = `*${selectedText}*`;
          break;
        case 'underline':
          newText = `<u>${selectedText}</u>`;
          break;
        case 'list':
          newText = `\n- ${selectedText || 'List item'}`;
          break;
        case 'link':
          newText = `[${selectedText || 'Link text'}](url)`;
          break;
        case 'image':
          newText = `![${selectedText || 'Alt text'}](image-url)`;
          break;
        case 'code':
          newText = `\`${selectedText}\``;
          break;
        default:
          return;
      }
      
      const newContent = value.substring(0, start) + newText + value.substring(end);
      onChange(newContent);
      
      // Set cursor position after the inserted text
      setTimeout(() => {
        textarea.focus();
        const newCursorPos = start + newText.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    }
  };

  const renderPreview = () => {
    return sanitizeMarkdown(value);
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Rich Text Editor</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPreview(!isPreview)}
            >
              {isPreview ? 'Edit' : 'Preview'}
            </Button>
          </div>
        </div>
        
        {!isPreview && (
          <div className="flex items-center gap-1 border-b pb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => insertMarkdown('bold', 'Bold text')}
              className="h-8 w-8 p-0"
            >
              <Bold className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => insertMarkdown('italic', 'Italic text')}
              className="h-8 w-8 p-0"
            >
              <Italic className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => insertMarkdown('underline', 'Underlined text')}
              className="h-8 w-8 p-0"
            >
              <Underline className="h-4 w-4" />
            </Button>
            <div className="w-px h-6 bg-border mx-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => insertMarkdown('list')}
              className="h-8 w-8 p-0"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => insertMarkdown('link')}
              className="h-8 w-8 p-0"
            >
              <Link className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => insertMarkdown('image')}
              className="h-8 w-8 p-0"
            >
              <Image className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => insertMarkdown('code')}
              className="h-8 w-8 p-0"
            >
              <Code className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardHeader>
      
      <CardContent>
        {isPreview ? (
          <div 
            className="min-h-[200px] p-4 border rounded-lg bg-background prose max-w-none"
            dangerouslySetInnerHTML={createSafeHtml(renderPreview())}
          />
        ) : (
          <Textarea
            id="wysiwyg-content"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="min-h-[200px] resize-none"
            style={{ fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace' }}
          />
        )}
        
        <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
          <div>
            Supports: **bold**, *italic*, `code`, [links](url), images, and lists
          </div>
          <div>
            {value.length} characters
          </div>
        </div>
      </CardContent>
    </Card>
  );
};