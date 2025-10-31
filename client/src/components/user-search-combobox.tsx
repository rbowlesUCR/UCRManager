import { useState } from "react";
import { Check, ChevronsUpDown, Loader2, User } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TeamsUser } from "@shared/schema";

interface UserSearchComboboxProps {
  users: TeamsUser[];
  isLoading: boolean;
  selectedUser: TeamsUser | null;
  onSelectUser: (user: TeamsUser | null) => void;
}

export function UserSearchCombobox({
  users,
  isLoading,
  selectedUser,
  onSelectUser,
}: UserSearchComboboxProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-11 w-full justify-between"
          disabled={isLoading}
          data-testid="button-user-search"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading users...
            </span>
          ) : selectedUser ? (
            <span className="flex items-center gap-2">
              <User className="w-4 h-4" />
              {selectedUser.displayName}
            </span>
          ) : (
            "Select a Teams user..."
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command>
          <CommandInput placeholder="Search users..." data-testid="input-search-users" />
          <CommandList>
            <CommandEmpty>No users found.</CommandEmpty>
            <CommandGroup>
              {users.map((user) => (
                <CommandItem
                  key={user.id}
                  value={user.displayName}
                  onSelect={() => {
                    onSelectUser(user.id === selectedUser?.id ? null : user);
                    setOpen(false);
                  }}
                  data-testid={`item-user-${user.id}`}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedUser?.id === user.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span className="font-medium">{user.displayName}</span>
                    <span className="text-xs text-muted-foreground">
                      {user.userPrincipalName}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
