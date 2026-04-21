/**
 * PromptTemplateSelector — Loads prompt templates from Supabase and displays as a dropdown
 * Auto-creates system templates on first load for the current user
 */
import { useEffect, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Pencil } from 'lucide-react';

// System templates - these will be created for each user on first load
const SYSTEM_TEMPLATES = [
  { name: 'Rispondi formale', prompt_text: 'Rispondi sempre in modo professionale e formale a questo mittente.', category: 'general' },
  { name: 'Ignora newsletter', prompt_text: 'Ignora questo mittente. Non classificare, non rispondere, archivia automaticamente.', category: 'newsletter' },
  { name: 'Priorità alta', prompt_text: 'Questo mittente è prioritario. Notifica immediatamente e classifica come urgente.', category: 'general' },
  { name: 'Follow-up commerciale', prompt_text: 'Analizza il contenuto per opportunità commerciali. Suggerisci follow-up se necessario.', category: 'commercial' },
  { name: 'Solo monitoraggio', prompt_text: 'Monitora le email di questo mittente senza azioni automatiche. Log per analisi.', category: 'general' },
  { name: 'Rispondi cordiale informale', prompt_text: 'Rispondi in modo cordiale e informale. Tono amichevole.', category: 'general' },
  { name: 'Supporto tecnico', prompt_text: 'Classifica come richiesta supporto. Cerca soluzioni nella KB prima di rispondere.', category: 'support' },
  { name: 'Blocca spam', prompt_text: 'Questo mittente è spam. Elimina automaticamente tutte le email future.', category: 'spam' }
];

interface PromptTemplate {
  id: string;
  name: string;
  prompt_text: string;
  category: string;
}

interface PromptTemplateSelectorProps {
  customPrompt: string | null;
  onPromptChange: (prompt: string) => void;
  isEditing?: boolean;
}

export function PromptTemplateSelector({
  customPrompt,
  onPromptChange,
  isEditing = false
}: PromptTemplateSelectorProps) {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [showCustomEdit, setShowCustomEdit] = useState(false);
  const [editText, setEditText] = useState(customPrompt || "");
  const [isPersonalizing, setIsPersonalizing] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setIsLoading(true);

      // Get current user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('Non autenticato');
      }

      // Ensure system templates exist for this user
      await ensureSystemTemplates(user.id);

      // Fetch all templates for current user
      const { data, error } = await supabase
        .from('prompt_templates')
        .select('*')
        .eq('user_id', user.id)
        .order('is_system', { ascending: false })
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      setTemplates(data || []);
    } catch (err) {
      toast.error('Errore caricamento template');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const ensureSystemTemplates = async (userId: string) => {
    try {
      // Check if system templates already exist
      const { data: existing } = await supabase
        .from('prompt_templates')
        .select('name')
        .eq('user_id', userId)
        .eq('is_system', true)
        .limit(1);

      if (existing && existing.length > 0) {
        return; // Templates already created
      }

      // Create all system templates for this user
      const templatesWithUserId = SYSTEM_TEMPLATES.map(t => ({
        ...t,
        user_id: userId,
        is_system: true
      }));

      const { error } = await supabase
        .from('prompt_templates')
        .insert(templatesWithUserId);

      if (error && error.code !== '23505') {
        // 23505 is unique constraint violation, which is expected if templates already exist
        throw error;
      }
    } catch (err) {
      console.error('Error ensuring system templates:', err);
      // Don't throw - templates might already exist
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setSelectedTemplateId(templateId);
      onPromptChange(template.prompt_text);
      setEditText(template.prompt_text);
      setShowCustomEdit(false);
    }
  };

  const handlePersonalize = () => {
    setIsPersonalizing(true);
    setShowCustomEdit(true);
  };

  const handleSaveCustom = () => {
    onPromptChange(editText);
    setShowCustomEdit(false);
    setSelectedTemplateId("");
    setIsPersonalizing(false);
  };

  const handleCancel = () => {
    setEditText(customPrompt || "");
    setShowCustomEdit(false);
    setIsPersonalizing(false);
  };

  // Group templates by category
  const groupedTemplates = templates.reduce((acc, template) => {
    const category = template.category || 'general';
    if (!acc[category]) acc[category] = [];
    acc[category].push(template);
    return acc;
  }, {} as Record<string, PromptTemplate[]>);

  const categoryLabels: Record<string, string> = {
    general: 'Generale',
    commercial: 'Commerciale',
    support: 'Supporto',
    newsletter: 'Newsletter',
    spam: 'Spam'
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Template Selector Dropdown */}
      <div className="flex items-center gap-2">
        <Select value={selectedTemplateId} onValueChange={handleTemplateSelect} disabled={isLoading || showCustomEdit}>
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder={isLoading ? "Caricamento..." : "Seleziona template…"} />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(groupedTemplates).map(([category, categoryTemplates]) => (
              <div key={category}>
                {/* Category label as visual separator */}
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                  {categoryLabels[category] || category}
                </div>
                {categoryTemplates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </div>
            ))}
          </SelectContent>
        </Select>

        {/* Personalizza button */}
        {selectedTemplateId && !showCustomEdit && (
          <Button
            size="sm"
            variant="outline"
            onClick={handlePersonalize}
            title="Personalizza il prompt selezionato"
            className="h-9 px-2"
          >
            <Pencil className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Custom Prompt Textarea */}
      <div className={showCustomEdit ? "block" : "hidden"}>
        <Textarea
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          placeholder="Inserisci un prompt personalizzato per questo mittente…"
          className="text-sm h-24"
          disabled={isLoading}
        />
        <div className="flex gap-2 mt-2">
          <Button
            size="sm"
            onClick={handleSaveCustom}
            disabled={isLoading || !editText.trim()}
          >
            Salva
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCancel}
          >
            Annulla
          </Button>
        </div>
      </div>

      {/* Display current prompt if not editing */}
      {!showCustomEdit && customPrompt && (
        <div className="bg-muted/30 p-2 rounded text-sm text-muted-foreground border border-muted">
          <div className="text-xs font-semibold mb-1">Prompt attivo:</div>
          <div className="line-clamp-2">{customPrompt}</div>
        </div>
      )}
    </div>
  );
}
