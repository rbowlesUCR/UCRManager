/**
 * ConnectWise Ticket Search Component
 *
 * Reusable autocomplete search component for finding ConnectWise tickets
 */

import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, Loader2, Ticket } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useQuery } from "@tanstack/react-query";

interface ConnectWiseTicket {
  id: number;
  summary: string;
  status: string;
  company: string;
  board: string | { id: number; name: string }; // Can be string from search or object from getTicket
}

interface ConnectWiseTicketSearchProps {
  tenantId: string;
  value?: number | null;
  onSelect: (ticketId: number | null, ticket: ConnectWiseTicket | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

async function searchTickets(tenantId: string, query: string): Promise<ConnectWiseTicket[]> {
  if (!query || query.length < 2) {
    return [];
  }

  const response = await fetch(`/api/admin/tenant/${tenantId}/connectwise/tickets/search?q=${encodeURIComponent(query)}&limit=25`);

  if (!response.ok) {
    throw new Error("Failed to search tickets");
  }

  const data = await response.json();
  return data.tickets || [];
}

async function getTicket(tenantId: string, ticketId: number): Promise<ConnectWiseTicket | null> {
  try {
    const response = await fetch(`/api/admin/tenant/${tenantId}/connectwise/tickets/${ticketId}`);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.ticket ? {
      id: data.ticket.id,
      summary: data.ticket.summary,
      status: data.ticket.status?.name || 'Unknown',
      company: data.ticket.company?.name || 'Unknown',
      board: data.ticket.board ? { id: data.ticket.board.id, name: data.ticket.board.name } : 'Unknown',
    } : null;
  } catch (error) {
    console.error("Error fetching ticket:", error);
    return null;
  }
}

export function ConnectWiseTicketSearch({
  tenantId,
  value,
  onSelect,
  placeholder = "Search ticket by # or summary...",
  disabled = false,
  className,
}: ConnectWiseTicketSearchProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<ConnectWiseTicket | null>(null);

  // Fetch initial ticket if value is provided
  useEffect(() => {
    if (value && !selectedTicket) {
      getTicket(tenantId, value).then((ticket) => {
        if (ticket) {
          setSelectedTicket(ticket);
        }
      });
    }
  }, [value, tenantId]);

  // Search tickets query
  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["connectwise-tickets-search", tenantId, searchQuery],
    queryFn: () => searchTickets(tenantId, searchQuery),
    enabled: searchQuery.length >= 2,
    staleTime: 30000, // Cache for 30 seconds
  });

  const handleSelect = (ticketId: number | null) => {
    if (ticketId === null) {
      setSelectedTicket(null);
      onSelect(null, null);
      setOpen(false);
      return;
    }

    const ticket = tickets.find((t) => t.id === ticketId);
    if (ticket) {
      setSelectedTicket(ticket);
      onSelect(ticket.id, ticket);
      setOpen(false);
      setSearchQuery("");
    }
  };

  const displayText = selectedTicket
    ? `#${selectedTicket.id} - ${selectedTicket.summary}`
    : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
          disabled={disabled}
        >
          <span className="flex items-center gap-2 truncate">
            <Ticket className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{displayText}</span>
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[500px] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={placeholder}
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            {isLoading && searchQuery.length >= 2 && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            )}
            {!isLoading && searchQuery.length >= 2 && tickets.length === 0 && (
              <CommandEmpty>No tickets found</CommandEmpty>
            )}
            {searchQuery.length > 0 && searchQuery.length < 2 && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Type at least 2 characters to search
              </div>
            )}
            {tickets.length > 0 && (
              <CommandGroup>
                {selectedTicket && (
                  <CommandItem
                    value="clear"
                    onSelect={() => handleSelect(null)}
                    className="text-muted-foreground italic"
                  >
                    <Check className={cn("mr-2 h-4 w-4", "opacity-0")} />
                    Clear selection
                  </CommandItem>
                )}
                {tickets.map((ticket) => (
                  <CommandItem
                    key={ticket.id}
                    value={ticket.id.toString()}
                    onSelect={() => handleSelect(ticket.id)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedTicket?.id === ticket.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col gap-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">#{ticket.id}</span>
                        <span className="text-sm truncate flex-1">{ticket.summary}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="px-2 py-0.5 bg-secondary rounded-sm">{ticket.status}</span>
                        <span>{ticket.company}</span>
                        <span>•</span>
                        <span>{typeof ticket.board === 'string' ? ticket.board : ticket.board.name}</span>
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Display component for showing linked ticket info
 */
interface TicketDisplayProps {
  ticket: ConnectWiseTicket;
  onRemove?: () => void;
  showRemove?: boolean;
}

export function TicketDisplay({ ticket, onRemove, showRemove = true }: TicketDisplayProps) {
  return (
    <div className="flex items-center gap-2 p-3 bg-secondary/50 rounded-md border">
      <Ticket className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">#{ticket.id}</span>
          <span className="text-sm truncate">{ticket.summary}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="px-2 py-0.5 bg-background rounded-sm">{ticket.status}</span>
          <span className="truncate">{ticket.company}</span>
        </div>
      </div>
      {showRemove && onRemove && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="h-8 flex-shrink-0"
        >
          Remove
        </Button>
      )}
    </div>
  );
}
