/**
 * SenderManagementTab — Ported from tmwengine EmailManagementTab, adapted to WCA data model.
 * Drag-and-drop sender classification with groups grid.
 */
import { useState, useEffect, useMemo } from 'react';
import { deriveSenderDisplayName } from '@/lib/senderDisplayName';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RefreshCw, Loader2, Plus, Search, ArrowUpDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { SenderCard } from './management/SenderCard';
import { GroupDropZone } from './management/GroupDropZone';
import { CreateCategoryDialog } from './management/CreateCategoryDialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { EmailSenderGroup, SenderAnalysis, SortOption } from '@/types/email-management';
import { DEFAULT_GROUPS as PREDEFINED_GROUPS } from '@/types/email-management';

export function SenderManagementTab() {
  const [senders, setSenders] = useState<SenderAnalysis[]>([]);
  const [groups, setGroups] = useState<EmailSenderGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [sortOption, setSortOption] = useState<SortOption>('count-desc');
  const [activeDrag, setActiveDrag] = useState<SenderAnalysis | null>(null);
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);

  // Collision detection during drag
  useEffect(() => {
    if (!activeDrag) return;
    const handleDrag = (e: DragEvent) => {
      if (e.clientX === 0 && e.clientY === 0) return;
      const dropZones = document.querySelectorAll('[data-drop-zone="true"]');
      let found = false;
      dropZones.forEach(zone => {
        const rect = zone.getBoundingClientRect();
        if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
          const gid = zone.getAttribute('data-group-id');
          if (gid) { setHoveredGroupId(gid); found = true; }
        }
      });
      if (!found) setHoveredGroupId(null);
    };
    document.addEventListener('drag', handleDrag);
    return () => document.removeEventListener('drag', handleDrag);
  }, [activeDrag]);

  useEffect(() => { loadData(); }, []);

  // Realtime
  useEffect(() => {
    const ch = supabase.channel('sender-mgmt-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'email_sender_groups' }, () => loadGroups())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const loadGroups = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('email_sender_groups')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });
    setGroups((data || []) as EmailSenderGroup[]);
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non autenticato');

      // Load groups
      const { data: groupsData } = await supabase
        .from('email_sender_groups')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      const loadedGroups = (groupsData || []) as EmailSenderGroup[];

      // First load: create defaults if none
      if (loadedGroups.length === 0) {
        const inserts = PREDEFINED_GROUPS.map(g => ({
          nome_gruppo: g.name, descrizione: g.description,
          colore: g.color, icon: g.icon, user_id: user.id,
        }));
        const { data: created } = await supabase.from('email_sender_groups').insert(inserts).select();
        if (created) {
          setGroups(created as EmailSenderGroup[]);
          toast.success(`${created.length} gruppi predefiniti creati`);
        }
      } else {
        setGroups(loadedGroups);
      }

      // Load senders from channel_messages
      const { data: messages } = await supabase
        .from('channel_messages')
        .select('from_address, direction, created_at')
        .eq('channel', 'email')
        .eq('direction', 'inbound')
        .not('from_address', 'is', null);

      const senderMap = new Map<string, SenderAnalysis>();
      for (const msg of messages || []) {
        const email = (msg.from_address || '').toLowerCase().trim();
        if (!email || !email.includes('@')) continue;
        const domain = email.split('@')[1];
        const existing = senderMap.get(email);
        if (existing) {
          existing.emailCount++;
          if (msg.created_at < existing.firstSeen) existing.firstSeen = msg.created_at;
          if (msg.created_at > existing.lastSeen) existing.lastSeen = msg.created_at;
        } else {
          senderMap.set(email, {
            email, domain,
            companyName: deriveSenderDisplayName(email),
            emailCount: 1,
            firstSeen: msg.created_at, lastSeen: msg.created_at,
            isClassified: false,
          });
        }
      }

      // Check which are already assigned
      const { data: rules } = await supabase
        .from('email_address_rules')
        .select('email_address, group_name')
        .eq('user_id', user.id)
        .not('group_name', 'is', null);

      const assignedSet = new Set((rules || []).map(r => r.email_address.toLowerCase()));
      const allSenders = Array.from(senderMap.values());
      for (const s of allSenders) {
        s.isClassified = assignedSet.has(s.email);
      }

      setSenders(allSenders.filter(s => !s.isClassified));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Errore caricamento';
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateCategory = async (data: { nome_gruppo: string; descrizione?: string; colore: string; icon: string }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: created, error } = await supabase
      .from('email_sender_groups')
      .insert({ ...data, user_id: user.id })
      .select()
      .single();
    if (error) { toast.error('Errore creazione categoria'); throw error; }
    setGroups(prev => [...prev, created as EmailSenderGroup]);
    toast.success(`${data.nome_gruppo} creato`);
  };

  const handleDragStart = (sender: SenderAnalysis) => setActiveDrag(sender);

  const handleDragEnd = async (clientX: number, clientY: number) => {
    if (!activeDrag) return;
    const dropZones = document.querySelectorAll('[data-drop-zone="true"]');
    let targetGroupId: string | null = null;
    let targetGroupName: string | null = null;

    dropZones.forEach(zone => {
      const rect = zone.getBoundingClientRect();
      if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
        targetGroupId = zone.getAttribute('data-group-id');
        targetGroupName = zone.getAttribute('data-group-name');
      }
    });

    if (targetGroupId && targetGroupName) {
      await assignToGroup(activeDrag, targetGroupName, targetGroupId);
    }
    setActiveDrag(null);
    setHoveredGroupId(null);
  };

  const assignToGroup = async (sender: SenderAnalysis, groupName: string, _groupId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const group = groups.find(g => g.nome_gruppo === groupName);

    // Upsert in email_address_rules
    const { data: existing } = await supabase
      .from('email_address_rules')
      .select('id')
      .eq('email_address', sender.email)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      await supabase.from('email_address_rules')
        .update({ group_name: groupName, group_color: group?.colore, group_icon: group?.icon })
        .eq('id', existing.id);
    } else {
      await supabase.from('email_address_rules').insert({
        email_address: sender.email,
        user_id: user.id,
        group_name: groupName,
        group_color: group?.colore,
        group_icon: group?.icon,
        domain: sender.domain,
        company_name: sender.companyName,
        email_count: sender.emailCount,
        is_active: true,
      });
    }

    // Optimistic update
    setSenders(prev => prev.filter(s => s.email !== sender.email));
    toast.success(`${sender.companyName} → ${groupName}`);
  };

  // Filter & sort
  const filteredSenders = senders.filter(s =>
    !searchQuery ||
    s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.companyName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedSenders = useMemo(() => {
    const sorted = [...filteredSenders];
    switch (sortOption) {
      case 'name-asc': return sorted.sort((a, b) => a.companyName.localeCompare(b.companyName));
      case 'name-desc': return sorted.sort((a, b) => b.companyName.localeCompare(a.companyName));
      case 'count-asc': return sorted.sort((a, b) => a.emailCount - b.emailCount);
      case 'count-desc': return sorted.sort((a, b) => b.emailCount - a.emailCount);
      default: return sorted;
    }
  }, [filteredSenders, sortOption]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
          <p className="text-sm text-muted-foreground">Analisi mittenti in corso…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9 h-9" placeholder="Cerca mittente…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        <Select value={sortOption} onValueChange={v => setSortOption(v as SortOption)}>
          <SelectTrigger className="w-[160px] h-9">
            <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" /><SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="count-desc">Più email</SelectItem>
            <SelectItem value="count-asc">Meno email</SelectItem>
            <SelectItem value="name-asc">A → Z</SelectItem>
            <SelectItem value="name-desc">Z → A</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nuovo gruppo
        </Button>
        <Button variant="ghost" size="sm" onClick={loadData}>
          <RefreshCw className="h-4 w-4 mr-1" /> Aggiorna
        </Button>
      </div>

      {/* Main layout: senders left, groups right */}
      <div className="flex flex-1 gap-4 min-h-0">
        {/* Sender list */}
        <div className="w-[320px] flex-shrink-0 flex flex-col border rounded-lg">
          <div className="px-3 py-2 border-b bg-muted/30">
            <span className="text-xs font-medium text-muted-foreground">
              Non classificati ({sortedSenders.length})
            </span>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-2">
              {sortedSenders.length === 0 ? (
                <p className="text-center py-8 text-sm text-muted-foreground">
                  {searchQuery ? 'Nessun risultato' : 'Tutti i mittenti sono classificati ✅'}
                </p>
              ) : (
                sortedSenders.map(sender => (
                  <SenderCard key={sender.email} sender={sender}
                    onDragStart={handleDragStart} onDragEnd={handleDragEnd} />
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Groups grid */}
        <div className="flex-1 min-w-0">
          <div className="px-3 py-2 border-b bg-muted/30 rounded-t-lg border border-b-0">
            <span className="text-xs font-medium text-muted-foreground">
              Gruppi ({groups.length})
            </span>
          </div>
          <ScrollArea className="border rounded-b-lg" style={{ height: 'calc(100% - 36px)' }}>
            <div className="p-4 flex flex-wrap gap-4">
              {groups.map(group => (
                <GroupDropZone key={group.id} group={group} onRefresh={loadData}
                  isHovered={hoveredGroupId === group.id} />
              ))}
              {groups.length === 0 && (
                <p className="text-muted-foreground text-center w-full py-12">Nessun gruppo — creane uno</p>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      <CreateCategoryDialog open={showCreateDialog} onOpenChange={setShowCreateDialog}
        onSubmit={handleCreateCategory} existingNames={groups.map(g => g.nome_gruppo)} />
    </div>
  );
}
